import PDFDocument from 'pdfkit';
import { Settings } from '../entities/Settings';
import { Teacher } from '../entities/Teacher';
import { Class } from '../entities/Class';
import { TimetableSlot } from '../entities/TimetableSlot';
import { TimetableConfig } from '../entities/TimetableConfig';

interface TimetablePDFData {
  type: 'teacher' | 'class' | 'consolidated';
  teacher?: Teacher;
  class?: Class;
  teachers?: Teacher[];
  slots: TimetableSlot[];
  settings: Settings | null;
  config?: TimetableConfig | null;
  versionName?: string;
}

// Helper function to calculate time slots from config
function calculateTimeSlotsFromConfig(config: TimetableConfig): Array<{ startTime: string; endTime: string }> {
  const timeSlots: Array<{ startTime: string; endTime: string }> = [];
  const startMinutes = parseTime(config.schoolStartTime);
  const periodDuration = config.periodDurationMinutes;

  for (let i = 0; i < config.periodsPerDay; i++) {
    const slotStartMinutes = startMinutes + (i * periodDuration);
    const slotEndMinutes = slotStartMinutes + periodDuration;
    
    timeSlots.push({
      startTime: formatTime(slotStartMinutes),
      endTime: formatTime(slotEndMinutes)
    });
  }

  return timeSlots;
}

// Helper function to parse time string (HH:MM) to minutes
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

// Helper function to format minutes to time string (HH:MM)
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function createTimetablePDF(data: TimetablePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const { type, teacher, class: classEntity, slots, settings, config } = data;
      
      const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Add logo and school name at the top
      let logoY = 30;
      if (settings?.schoolLogo || settings?.schoolLogo2) {
        const logoData = settings.schoolLogo || settings.schoolLogo2;
        try {
          if (typeof logoData === 'string') {
            if (logoData.startsWith('data:')) {
              const base64Data = logoData.split(',')[1];
              const imageBuffer = Buffer.from(base64Data, 'base64');
              doc.image(imageBuffer, 40, logoY, { width: 60, height: 60, fit: [60, 60] });
            } else {
              // Assume it's a URL or file path - for now, skip if not base64
              console.warn('[createTimetablePDF] Logo is not in base64 format, skipping');
            }
          }
        } catch (logoError) {
          console.error('[createTimetablePDF] Error loading logo:', logoError);
        }
      }

      // Title Section
      let yPos = 100;
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
      
      let title = 'TIMETABLE';
      let subtitle = '';
      if (type === 'teacher' && teacher) {
        title = `${settings?.schoolName || 'School'}: ${data.versionName || 'Timetable'}`;
        subtitle = `Teacher: ${teacher.firstName} ${teacher.lastName}`;
      } else if (type === 'class' && classEntity) {
        title = `${settings?.schoolName || 'School'}: ${data.versionName || 'Timetable'}`;
        subtitle = `Class: ${classEntity.name}`;
      } else if (type === 'consolidated') {
        title = `${settings?.schoolName || 'School'}: ${data.versionName || 'Timetable'}`;
        subtitle = 'Summary timetable of teachers';
      }

      doc.text(title, 40, yPos, { align: 'center', width: doc.page.width - 80 });
      if (subtitle) {
        yPos += 20;
        doc.fontSize(12).font('Helvetica').fillColor('#666666');
        doc.text(subtitle, 40, yPos, { align: 'center', width: doc.page.width - 80 });
      }
      yPos += 25;

      // SPECIAL LAYOUT FOR CONSOLIDATED: Teachers as rows, Days as columns, Periods as sub-columns
      if (type === 'consolidated' && data.teachers && data.teachers.length > 0) {
        createConsolidatedTimetableLayout(doc, data, settings, config, yPos);
        return; // Exit early, the function will call doc.end()
      }

      // Get days of week from slots or config
      const daysOfWeek = config?.daysOfWeek || Array.from(new Set(slots.map(s => s.dayOfWeek))).sort();
      const periods = Array.from(new Set(slots.map(s => s.periodNumber))).sort((a, b) => a - b);
      
      // Get all periods including breaks - calculate time slots
      const allPeriods: number[] = [];
      const periodTimeSlots: Map<number, { startTime: string; endTime: string }> = new Map();
      
      if (config) {
        const timeSlots = calculateTimeSlotsFromConfig(config);
        for (let i = 1; i <= config.periodsPerDay; i++) {
          allPeriods.push(i);
          if (timeSlots[i - 1]) {
            periodTimeSlots.set(i, timeSlots[i - 1]);
          }
        }
      } else {
        allPeriods.push(...periods);
        periods.forEach(period => {
          const slot = slots.find(s => s.periodNumber === period && !s.isBreak);
          if (slot && slot.startTime && slot.endTime) {
            periodTimeSlots.set(period, { startTime: slot.startTime, endTime: slot.endTime });
          }
        });
      }

      // Identify break periods and their positions
      const breakPeriods: Array<{ period: number; name: string; startTime: string; endTime: string }> = [];
      if (config?.breakPeriods && config.breakPeriods.length > 0) {
        const timeSlots = calculateTimeSlotsFromConfig(config);
        config.breakPeriods.forEach(breakPeriod => {
          // Find which period(s) the break overlaps with
          const breakStart = parseTime(breakPeriod.startTime);
          const breakEnd = parseTime(breakPeriod.endTime);
          
          for (let i = 0; i < timeSlots.length; i++) {
            const periodStart = parseTime(timeSlots[i].startTime);
            const periodEnd = parseTime(timeSlots[i].endTime);
            
            // Check if break overlaps with this period
            if ((breakStart >= periodStart && breakStart < periodEnd) ||
                (breakEnd > periodStart && breakEnd <= periodEnd) ||
                (breakStart <= periodStart && breakEnd >= periodEnd)) {
              breakPeriods.push({
                period: i + 1,
                name: breakPeriod.name,
                startTime: breakPeriod.startTime,
                endTime: breakPeriod.endTime
              });
              break; // Only add once per break
            }
          }
        });
      }

      if (daysOfWeek.length === 0 || allPeriods.length === 0) {
        doc.fontSize(12).font('Helvetica').fillColor('#666666');
        doc.text('No timetable data available.', 40, yPos);
        return;
      }

      // NEW LAYOUT: Days as rows (left), Periods as columns (top)
      const tableStartX = 40;
      const tableStartY = yPos + 20;
      const dayColumnWidth = 80; // Column for day names
      const periodHeaderHeight = 35; // Height for period headers with times
      const cellHeight = 25; // Height for each day row
      const cellWidth = (doc.page.width - 80 - dayColumnWidth) / (allPeriods.length + breakPeriods.length); // Width for each period column

      // Draw table header - NEW LAYOUT: Days column on left, Periods as columns on top
      // Day column header
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.rect(tableStartX, tableStartY, dayColumnWidth, periodHeaderHeight)
        .fillColor('#2c3e50')
        .fill();
      doc.text('Day', tableStartX + 5, tableStartY + 12, { width: dayColumnWidth - 10, align: 'center' });
      
      // Period headers across the top
      let currentX = tableStartX + dayColumnWidth;
      let periodIndex = 0;
      
      for (let i = 0; i < allPeriods.length; i++) {
        const period = allPeriods[i];
        const timeSlot = periodTimeSlots.get(period);
        
        // Check if there's a break before this period
        const breakBefore = breakPeriods.find(bp => bp.period === period);
        if (breakBefore && i === 0) {
          // Draw break header first
          doc.rect(currentX, tableStartY, cellWidth, periodHeaderHeight)
            .fillColor('#95a5a6')
            .fill();
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
          // Rotate text for break
          doc.save();
          doc.translate(currentX + cellWidth / 2, tableStartY + periodHeaderHeight / 2);
          doc.rotate(90);
          doc.text(breakBefore.name, 0, 0, { align: 'center', width: periodHeaderHeight });
          doc.restore();
          // Time below
          doc.fontSize(7).font('Helvetica').fillColor('#FFFFFF');
          doc.text(`${breakBefore.startTime} - ${breakBefore.endTime}`, currentX + 2, tableStartY + periodHeaderHeight - 8, { width: cellWidth - 4, align: 'center' });
          currentX += cellWidth;
        }
        
        // Draw period header
        doc.rect(currentX, tableStartY, cellWidth, periodHeaderHeight)
          .fillColor('#2c3e50')
          .fill();
        
        if (timeSlot) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text(`Period ${period}`, currentX + 2, tableStartY + 5, { width: cellWidth - 4, align: 'center' });
          doc.fontSize(8).font('Helvetica').fillColor('#E8F4FD');
          doc.text(`${timeSlot.startTime} - ${timeSlot.endTime}`, currentX + 2, tableStartY + 18, { width: cellWidth - 4, align: 'center' });
        } else {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text(`Period ${period}`, currentX + 2, tableStartY + 12, { width: cellWidth - 4, align: 'center' });
        }
        
        currentX += cellWidth;
        
        // Check if there's a break after this period
        const breakAfter = breakPeriods.find(bp => bp.period === period + 1);
        if (breakAfter && i < allPeriods.length - 1) {
          // Draw break header
          doc.rect(currentX, tableStartY, cellWidth, periodHeaderHeight)
            .fillColor('#95a5a6')
            .fill();
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
          // Rotate text for break
          doc.save();
          doc.translate(currentX + cellWidth / 2, tableStartY + periodHeaderHeight / 2);
          doc.rotate(90);
          doc.text(breakAfter.name, 0, 0, { align: 'center', width: periodHeaderHeight });
          doc.restore();
          // Time below
          doc.fontSize(7).font('Helvetica').fillColor('#FFFFFF');
          doc.text(`${breakAfter.startTime} - ${breakAfter.endTime}`, currentX + 2, tableStartY + periodHeaderHeight - 8, { width: cellWidth - 4, align: 'center' });
          currentX += cellWidth;
        }
      }

      // Draw table rows - NEW LAYOUT: Each row is a day
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      daysOfWeek.forEach((day, dayIndex) => {
        const rowY = tableStartY + periodHeaderHeight + (dayIndex * cellHeight);

        // Day name cell (left column)
        doc.rect(tableStartX, rowY, dayColumnWidth, cellHeight)
          .fillColor('#ecf0f1')
          .fill();
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#2c3e50');
        doc.text(day, tableStartX + 5, rowY + 8, { width: dayColumnWidth - 10, align: 'center' });

        // Period cells across the row
        let currentX = tableStartX + dayColumnWidth;
        let periodColIndex = 0;
        
        for (let i = 0; i < allPeriods.length; i++) {
          const period = allPeriods[i];
          
          // Check if there's a break before this period
          const breakBefore = breakPeriods.find(bp => bp.period === period);
          if (breakBefore && i === 0) {
            // Draw break cell spanning all days
            doc.rect(currentX, rowY, cellWidth, cellHeight)
              .fillColor('#f0f0f0')
              .fill();
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#95a5a6');
            doc.text(breakBefore.name, currentX + 2, rowY + 8, { width: cellWidth - 4, align: 'center' });
            currentX += cellWidth;
            periodColIndex++;
          }
          
          // Draw period cell
          const cellSlots = slots.filter(s => s.dayOfWeek === day && s.periodNumber === period && !s.isBreak);
          
          doc.rect(currentX, rowY, cellWidth, cellHeight)
            .strokeColor('#bdc3c7')
            .lineWidth(0.5)
            .stroke();
          
          if (cellSlots.length > 0) {
            const slot = cellSlots[0];
            
            // For teacher timetable, show class name and subject
            if (type === 'teacher') {
              doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50');
              const classText = slot.class?.name || 'N/A';
              doc.text(classText, currentX + 3, rowY + 4, { width: cellWidth - 6, align: 'left' });
              
              doc.fontSize(8).font('Helvetica').fillColor('#34495e');
              const subjectText = slot.subject?.name || 'N/A';
              doc.text(subjectText, currentX + 3, rowY + 14, { width: cellWidth - 6, align: 'left' });
            } else if (type === 'class') {
              // For class timetable, show teacher and subject
              doc.fontSize(8).font('Helvetica').fillColor('#34495e');
              doc.text(`${slot.teacher?.firstName || ''} ${slot.teacher?.lastName || ''}`, currentX + 3, rowY + 4, { width: cellWidth - 6, align: 'left' });
              doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50');
              doc.text(slot.subject?.name || 'N/A', currentX + 3, rowY + 14, { width: cellWidth - 6, align: 'left' });
            } else {
              // For consolidated, show teacher, class, and subject
              doc.fontSize(7).font('Helvetica').fillColor('#34495e');
              doc.text(`${slot.teacher?.firstName || ''} ${slot.teacher?.lastName || ''}`, currentX + 3, rowY + 2, { width: cellWidth - 6, align: 'left' });
              doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
              doc.text(slot.class?.name || 'N/A', currentX + 3, rowY + 10, { width: cellWidth - 6, align: 'left' });
              doc.fontSize(7).font('Helvetica').fillColor('#7f8c8d');
              doc.text(slot.subject?.name || 'N/A', currentX + 3, rowY + 18, { width: cellWidth - 6, align: 'left' });
            }
          }
          
          currentX += cellWidth;
          periodColIndex++;
          
          // Check if there's a break after this period
          const breakAfter = breakPeriods.find(bp => bp.period === period + 1);
          if (breakAfter && i < allPeriods.length - 1) {
            // Draw break cell
            doc.rect(currentX, rowY, cellWidth, cellHeight)
              .fillColor('#f0f0f0')
              .fill();
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#95a5a6');
            doc.text(breakAfter.name, currentX + 2, rowY + 8, { width: cellWidth - 4, align: 'center' });
            currentX += cellWidth;
            periodColIndex++;
          }
        }
      });

      // Footer
      const footerY = tableStartY + periodHeaderHeight + (daysOfWeek.length * cellHeight) + 20;
      doc.fontSize(8).font('Helvetica').fillColor('#666666');
      doc.text(`Timetable generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`, 40, footerY);

      // Finalize the PDF - this triggers the 'end' event
      doc.end();
    } catch (error: any) {
      console.error('[createTimetablePDF] Error:', error);
      console.error('[createTimetablePDF] Error stack:', error.stack);
      reject(error);
    }
  });
}

// Special layout for consolidated timetable: Teachers as rows, Days as columns, Periods as sub-columns
function createConsolidatedTimetableLayout(
  doc: InstanceType<typeof PDFDocument>,
  data: TimetablePDFData,
  settings: Settings | null,
  config: TimetableConfig | null,
  startY: number
) {
  const { teachers, slots } = data;
  if (!teachers || teachers.length === 0) {
    doc.fontSize(12).font('Helvetica').fillColor('#666666');
    doc.text('No teachers available.', 40, startY);
    doc.end();
    return;
  }

  const daysOfWeek = config?.daysOfWeek || Array.from(new Set(slots.map(s => s.dayOfWeek))).sort();
  const allPeriods: number[] = [];
  const periodTimeSlots: Map<number, { startTime: string; endTime: string }> = new Map();
  
  if (config) {
    const timeSlots = calculateTimeSlotsFromConfig(config);
    for (let i = 1; i <= config.periodsPerDay; i++) {
      allPeriods.push(i);
      if (timeSlots[i - 1]) {
        periodTimeSlots.set(i, timeSlots[i - 1]);
      }
    }
  } else {
    const periods = Array.from(new Set(slots.map(s => s.periodNumber))).sort((a, b) => a - b);
    allPeriods.push(...periods);
    periods.forEach(period => {
      const slot = slots.find(s => s.periodNumber === period && !s.isBreak);
      if (slot && slot.startTime && slot.endTime) {
        periodTimeSlots.set(period, { startTime: slot.startTime, endTime: slot.endTime });
      }
    });
  }

  // Identify break periods
  const breakPeriods: Array<{ period: number; name: string; startTime: string; endTime: string }> = [];
  if (config?.breakPeriods && config.breakPeriods.length > 0) {
    const timeSlots = calculateTimeSlotsFromConfig(config);
    config.breakPeriods.forEach(breakPeriod => {
      const breakStart = parseTime(breakPeriod.startTime);
      const breakEnd = parseTime(breakPeriod.endTime);
      
      for (let i = 0; i < timeSlots.length; i++) {
        const periodStart = parseTime(timeSlots[i].startTime);
        const periodEnd = parseTime(timeSlots[i].endTime);
        
        if ((breakStart >= periodStart && breakStart < periodEnd) ||
            (breakEnd > periodStart && breakEnd <= periodEnd) ||
            (breakStart <= periodStart && breakEnd >= periodEnd)) {
          breakPeriods.push({
            period: i + 1,
            name: breakPeriod.name,
            startTime: breakPeriod.startTime,
            endTime: breakPeriod.endTime
          });
          break;
        }
      }
    });
  }

  // Calculate dimensions
  const tableStartX = 40;
  const tableStartY = startY + 10;
  const teacherColumnWidth = 100; // Column for teacher names
  const periodColumnWidth = 25; // Width for each period column (narrow for class codes)
  const cellHeight = 20; // Height for each teacher row
  const dayHeaderHeight = 30; // Height for day headers
  const periodHeaderHeight = 20; // Height for period sub-headers
  
  // Calculate total width needed - account for breaks (each break takes 2 columns)
  let totalPeriodColumns = allPeriods.length;
  breakPeriods.forEach(() => totalPeriodColumns += 1); // Each break adds 1 extra column
  const dayWidth = totalPeriodColumns * periodColumnWidth;
  
  // Draw header: Teacher column + Day columns
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#FFFFFF');
  
  // Teacher column header
  doc.rect(tableStartX, tableStartY, teacherColumnWidth, dayHeaderHeight + periodHeaderHeight)
    .fillColor('#2c3e50')
    .fill();
  doc.text('Teacher', tableStartX + 5, tableStartY + (dayHeaderHeight + periodHeaderHeight) / 2 - 5, { 
    width: teacherColumnWidth - 10, 
    align: 'center' 
  });

  // Day columns with period sub-headers
  let dayX = tableStartX + teacherColumnWidth;
  daysOfWeek.forEach((day) => {
    // Day header (spans all periods)
    doc.rect(dayX, tableStartY, dayWidth, dayHeaderHeight)
      .fillColor('#34495e')
      .fill();
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text(day, dayX + 5, tableStartY + 8, { width: dayWidth - 10, align: 'center' });
    
    // Period sub-headers
    let periodX = dayX;
    for (let i = 0; i < allPeriods.length; i++) {
      const period = allPeriods[i];
      
      // Check for break before period
      const breakBefore = breakPeriods.find(bp => bp.period === period);
      if (breakBefore && i === 0) {
        doc.rect(periodX, tableStartY + dayHeaderHeight, periodColumnWidth * 2, periodHeaderHeight)
          .fillColor('#95a5a6')
          .fill();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.save();
        doc.translate(periodX + periodColumnWidth, tableStartY + dayHeaderHeight + periodHeaderHeight / 2);
        doc.rotate(90);
        doc.text(breakBefore.name, 0, 0, { align: 'center', width: periodHeaderHeight });
        doc.restore();
        periodX += periodColumnWidth * 2;
        continue;
      }
      
      // Period header
      doc.rect(periodX, tableStartY + dayHeaderHeight, periodColumnWidth, periodHeaderHeight)
        .fillColor('#2c3e50')
        .fill();
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text(`${period}`, periodX + 2, tableStartY + dayHeaderHeight + 6, { 
        width: periodColumnWidth - 4, 
        align: 'center' 
      });
      periodX += periodColumnWidth;
      
      // Check for break after period
      const breakAfter = breakPeriods.find(bp => bp.period === period + 1);
      if (breakAfter && i < allPeriods.length - 1) {
        doc.rect(periodX, tableStartY + dayHeaderHeight, periodColumnWidth * 2, periodHeaderHeight)
          .fillColor('#95a5a6')
          .fill();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.save();
        doc.translate(periodX + periodColumnWidth, tableStartY + dayHeaderHeight + periodHeaderHeight / 2);
        doc.rotate(90);
        doc.text(breakAfter.name, 0, 0, { align: 'center', width: periodHeaderHeight });
        doc.restore();
        periodX += periodColumnWidth * 2;
      }
    }
    
    dayX += dayWidth;
  });

  // Draw teacher rows
  doc.fontSize(9).font('Helvetica').fillColor('#000000');
  teachers.forEach((teacher, teacherIndex) => {
    const rowY = tableStartY + dayHeaderHeight + periodHeaderHeight + (teacherIndex * cellHeight);
    
    // Teacher name cell
    doc.rect(tableStartX, rowY, teacherColumnWidth, cellHeight)
      .fillColor('#ecf0f1')
      .fill();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#2c3e50');
    const teacherName = `${teacher.firstName} ${teacher.lastName}`;
    doc.text(teacherName, tableStartX + 5, rowY + 6, { 
      width: teacherColumnWidth - 10, 
      align: 'left' 
    });
    
    // Day columns with period cells
    let dayX = tableStartX + teacherColumnWidth;
    daysOfWeek.forEach((day) => {
      let periodX = dayX;
      
      for (let i = 0; i < allPeriods.length; i++) {
        const period = allPeriods[i];
        
        // Check for break before period
        const breakBefore = breakPeriods.find(bp => bp.period === period);
        if (breakBefore && i === 0) {
          doc.rect(periodX, rowY, periodColumnWidth * 2, cellHeight)
            .fillColor('#f0f0f0')
            .fill();
          periodX += periodColumnWidth * 2;
          continue;
        }
        
        // Period cell
        const cellSlots = slots.filter(s => 
          s.teacherId === teacher.id && 
          s.dayOfWeek === day && 
          s.periodNumber === period && 
          !s.isBreak
        );
        
        doc.rect(periodX, rowY, periodColumnWidth, cellHeight)
          .strokeColor('#bdc3c7')
          .lineWidth(0.5)
          .stroke();
        
        if (cellSlots.length > 0) {
          const slot = cellSlots[0];
          // Show class code (e.g., "U6 SB", "3N EB")
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#2c3e50');
          const classCode = slot.class?.name || 'N/A';
          doc.text(classCode, periodX + 2, rowY + 6, { 
            width: periodColumnWidth - 4, 
            align: 'center' 
          });
        }
        
        periodX += periodColumnWidth;
        
        // Check for break after period
        const breakAfter = breakPeriods.find(bp => bp.period === period + 1);
        if (breakAfter && i < allPeriods.length - 1) {
          doc.rect(periodX, rowY, periodColumnWidth * 2, cellHeight)
            .fillColor('#f0f0f0')
            .fill();
          periodX += periodColumnWidth * 2;
        }
      }
      
      dayX += dayWidth;
    });
  });

  // Footer
  const footerY = tableStartY + dayHeaderHeight + periodHeaderHeight + (teachers.length * cellHeight) + 20;
  doc.fontSize(8).font('Helvetica').fillColor('#666666');
  doc.text(`Timetable generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`, 40, footerY);
  
  doc.end();
}
