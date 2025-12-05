import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ExamService } from '../../../services/exam.service';
import { ClassService } from '../../../services/class.service';
import { SubjectService } from '../../../services/subject.service';
import { SettingsService } from '../../../services/settings.service';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

@Component({
  selector: 'app-moderate-mark',
  templateUrl: './moderate-mark.component.html',
  styleUrls: ['./moderate-mark.component.css']
})
export class ModerateMarkComponent implements OnInit, AfterViewInit {
  @ViewChild('distributionChart', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  distributionChart: Chart | null = null;
  classes: any[] = [];
  subjects: any[] = [];
  
  selectedClassId = '';
  selectedSubjectId = '';
  selectedSubjectCode = '';
  selectedExamType = '';
  selectedTerm = '';
  targetMin = 30;
  targetMax = 90;
  
  examTypes = [
    { value: 'mid_term', label: 'Mid-Term' },
    { value: 'end_term', label: 'End-Term' }
  ];
  
  moderatedData: any = null;
  loading = false;
  savingMarks = false;
  error = '';
  success = '';
  
  constructor(
    private examService: ExamService,
    private classService: ClassService,
    private subjectService: SubjectService,
    private settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.loadClasses();
    this.loadSettings();
    // Ensure examTypes are initialized
    if (!this.examTypes || this.examTypes.length === 0) {
      this.examTypes = [
        { value: 'mid_term', label: 'Mid-Term' },
        { value: 'end_term', label: 'End-Term' }
      ];
    }
  }

  ngAfterViewInit() {
    // Chart will be drawn when data is available
  }

  loadSettings() {
    this.settingsService.getSettings().subscribe({
      next: (settings: any) => {
        this.selectedTerm = settings.activeTerm || settings.currentTerm || '';
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        this.selectedTerm = `Term 1 ${new Date().getFullYear()}`; // Fallback
      }
    });
  }

  loadClasses() {
    this.classService.getClasses().subscribe(
      (data: any) => {
        const classesList = Array.isArray(data) ? data : (data?.data || []);
        const activeClasses = classesList.filter((c: any) => c.isActive);
        this.classes = this.classService.sortClasses(activeClasses);
      },
      (error: any) => {
        console.error('Error loading classes:', error);
        this.error = 'Failed to load classes';
      }
    );
  }

  onClassChange() {
    this.selectedSubjectId = '';
    this.selectedSubjectCode = '';
    this.selectedExamType = '';
    this.subjects = [];
    this.moderatedData = null;
    
    if (this.selectedClassId) {
      this.loadSubjects();
    }
  }

  onExamTypeChange() {
    this.moderatedData = null;
  }

  loadSubjects() {
    if (!this.selectedClassId) return;
    
    // First try to get the class with subjects relation
    this.classService.getClassById(this.selectedClassId).subscribe(
      (classData: any) => {
        if (classData && classData.subjects && Array.isArray(classData.subjects) && classData.subjects.length > 0) {
          // Use subjects from class
          this.subjects = classData.subjects
            .filter((s: any) => s.isActive !== false)
            .map((s: any) => ({
              ...s,
              code: s.code || '',
              displayName: s.code ? `${s.code} - ${s.name}` : s.name
            }));
        
        console.log('Loaded subjects from class:', this.subjects.length, this.subjects.map(s => ({ name: s.name, code: s.code })));
        } else {
          // Fallback: load all subjects and filter by class relation
          this.loadAllSubjects();
        }
      },
      (classError: any) => {
        console.error('Error loading class with subjects:', classError);
        // Fallback: load all subjects
        this.loadAllSubjects();
      }
    );
  }

  loadAllSubjects() {
    this.subjectService.getSubjects().subscribe(
      (data: any) => {
        // Handle both array and paginated response formats
        let allSubjects: any[] = [];
        if (Array.isArray(data)) {
          allSubjects = data;
        } else if (data?.data && Array.isArray(data.data)) {
          allSubjects = data.data;
        } else if (data?.subjects && Array.isArray(data.subjects)) {
          allSubjects = data.subjects;
        }
        
        // Filter active subjects
        let filteredSubjects = allSubjects.filter((s: any) => s.isActive !== false);
        
        // Try to filter by class relation if available
        const subjectsWithClass = filteredSubjects.filter((s: any) => 
          s.classes && Array.isArray(s.classes) && s.classes.some((c: any) => c.id === this.selectedClassId)
        );
        
        // Use filtered subjects if available, otherwise show all active subjects
        const finalSubjects = subjectsWithClass.length > 0 ? subjectsWithClass : filteredSubjects;
        
        this.subjects = finalSubjects.map((s: any) => ({
          ...s,
          code: s.code || '',
          displayName: s.code ? `${s.code} - ${s.name}` : s.name
        }));
        
        console.log('Loaded subjects:', this.subjects.length, this.subjects.map(s => ({ name: s.name, code: s.code })));
      },
      (error: any) => {
        console.error('Error loading subjects:', error);
        this.error = 'Failed to load subjects';
        this.subjects = [];
      }
    );
  }

  onSubjectChange() {
    // Sync subject code when subject is selected by name
    const selectedSubject = this.subjects.find(s => s.id === this.selectedSubjectId);
    if (selectedSubject) {
      this.selectedSubjectCode = selectedSubject.code || '';
    } else {
      this.selectedSubjectCode = '';
    }
    this.moderatedData = null;
  }

  onSubjectCodeChange() {
    // Sync subject ID when subject is selected by code
    const selectedSubject = this.subjects.find(s => s.code === this.selectedSubjectCode);
    if (selectedSubject) {
      this.selectedSubjectId = selectedSubject.id;
    } else {
      this.selectedSubjectId = '';
    }
    this.moderatedData = null;
  }

  moderateMarks() {
    if (!this.selectedClassId || !this.selectedSubjectId || !this.selectedExamType) {
      this.error = 'Please select class, subject, and exam type';
      return;
    }

    if (!this.targetMin || !this.targetMax || isNaN(this.targetMin) || isNaN(this.targetMax)) {
      this.error = 'Please enter valid target minimum and maximum values';
      return;
    }

    if (this.targetMin < 0 || this.targetMin > 100 || this.targetMax < 0 || this.targetMax > 100) {
      this.error = 'Target minimum and maximum must be between 0 and 100';
      return;
    }

    if (this.targetMin >= this.targetMax) {
      this.error = 'Target minimum must be less than target maximum';
      return;
    }
    
    // Set selectedSubjectCode from selectedSubjectId
    const selectedSubject = this.subjects.find(s => s.id === this.selectedSubjectId);
    if (selectedSubject) {
      this.selectedSubjectCode = selectedSubject.code || '';
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    this.examService.moderateMarks(
      this.selectedClassId,
      this.selectedSubjectId,
      this.selectedExamType,
      this.targetMin,
      this.targetMax
    ).subscribe(
      (data: any) => {
        this.moderatedData = data;
        this.loading = false;
        this.success = 'Marks moderated successfully';
        // Draw distribution curve after data is loaded
        setTimeout(() => {
          this.drawDistributionChart();
        }, 100);
      },
      (error: any) => {
        console.error('Error moderating marks:', error);
        this.error = error.error?.message || 'Failed to moderate marks';
        this.loading = false;
      }
    );
  }

  printTable() {
    window.print();
  }

  drawDistributionChart() {
    if (!this.moderatedData || !this.moderatedData.results || this.moderatedData.results.length === 0) {
      return;
    }

    // Destroy existing chart if it exists
    if (this.distributionChart) {
      this.distributionChart.destroy();
    }

    // Get uniform marks
    const uniformMarks = this.moderatedData.results
      .map((r: any) => parseFloat(r.uniformMark) || 0)
      .filter((mark: number) => !isNaN(mark) && mark >= 0 && mark <= 100);

    if (uniformMarks.length === 0) {
      return;
    }

    // Calculate mean and standard deviation
    const mean = uniformMarks.reduce((a: number, b: number) => a + b, 0) / uniformMarks.length;
    const variance = uniformMarks.reduce((sum: number, mark: number) => sum + Math.pow(mark - mean, 2), 0) / uniformMarks.length;
    const stdDev = Math.sqrt(variance);

    // Generate data points for normal distribution curve
    const minMark = Math.max(0, Math.min(...uniformMarks) - 10);
    const maxMark = Math.min(100, Math.max(...uniformMarks) + 10);
    const step = (maxMark - minMark) / 100;
    
    const labels: number[] = [];
    const distributionData: number[] = [];
    
    for (let x = minMark; x <= maxMark; x += step) {
      labels.push(Math.round(x * 10) / 10);
      // Normal distribution formula: (1 / (σ * √(2π))) * e^(-0.5 * ((x - μ) / σ)²)
      const exponent = -0.5 * Math.pow((x - mean) / (stdDev || 1), 2);
      const value = (1 / (stdDev * Math.sqrt(2 * Math.PI) || 1)) * Math.exp(exponent);
      distributionData.push(value);
    }

    // Normalize the distribution to fit the chart (scale to max value)
    const maxValue = Math.max(...distributionData);
    const normalizedData = distributionData.map(v => (v / maxValue) * 100);

    // Create histogram bins for actual data (matching the distribution curve points)
    const histogram: number[] = new Array(labels.length).fill(0);
    
    uniformMarks.forEach((mark: number) => {
      // Find the closest label index
      const closestIndex = labels.reduce((prev, curr, idx) => {
        return Math.abs(curr - mark) < Math.abs(labels[prev] - mark) ? idx : prev;
      }, 0);
      if (closestIndex >= 0 && closestIndex < histogram.length) {
        histogram[closestIndex]++;
      }
    });

    // Normalize histogram to percentage (scale to match distribution curve)
    const maxHistCount = Math.max(...histogram, 1);
    const normalizedHistogram = histogram.map(count => (count / maxHistCount) * 100);

    if (!this.chartCanvas) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    this.distributionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Normal Distribution Curve',
            data: normalizedData,
            borderColor: 'rgb(74, 144, 226)',
            backgroundColor: 'rgba(74, 144, 226, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Normal Distribution of Moderated Marks',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Mark Percentage'
            },
            min: minMark,
            max: maxMark
          },
          y: {
            title: {
              display: true,
              text: 'Frequency (Normalized)'
            },
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }

  saveMarks() {
    if (!this.moderatedData || !this.moderatedData.results || this.moderatedData.results.length === 0) {
      this.error = 'No moderated marks to save. Please moderate marks first.';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    if (!this.selectedClassId || !this.selectedSubjectId || !this.selectedExamType) {
      this.error = 'Please ensure class, subject, and exam type are selected.';
      setTimeout(() => this.error = '', 5000);
      return;
    }

    this.savingMarks = true;
    this.error = '';
    this.success = '';

    // Prepare data for saving (only studentId and uniformMark)
    const marksToSave = this.moderatedData.results.map((r: any) => ({
      studentId: r.studentId,
      uniformMark: parseFloat(String(r.uniformMark)) || 0
    }));

    this.examService.saveModeratedMarks(
      this.selectedClassId,
      this.selectedSubjectId,
      this.selectedExamType,
      marksToSave
    ).subscribe({
      next: (response: any) => {
        this.savingMarks = false;
        this.success = response.message || `Successfully saved ${response.savedCount || marksToSave.length} moderated mark(s)!`;
        setTimeout(() => this.success = '', 8000);
      },
      error: (error: any) => {
        console.error('Error saving moderated marks:', error);
        this.error = error.error?.message || 'Failed to save moderated marks. Please try again.';
        this.savingMarks = false;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  downloadExcel() {
    if (!this.moderatedData || !this.moderatedData.results) {
      this.error = 'No data to download';
      return;
    }

    // Create CSV content
    const headers = [
      'School Name',
      'Subject',
      'Subject Teacher',
      'Exam Type',
      'Student ID',
      'FirstName',
      'LastName',
      'Raw Mark %',
      'Uniform Mark %'
    ];

    const rows = this.moderatedData.results.map((r: any) => [
      this.moderatedData.schoolName || '',
      this.moderatedData.subject || '',
      this.moderatedData.subjectTeacher || '',
      this.moderatedData.examType || '',
      r.studentNumber || '',
      r.firstName || '',
      r.lastName || '',
      r.rawMark || '0',
      r.uniformMark || '0'
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `moderated_marks_${this.moderatedData.subject}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.success = 'File downloaded successfully';
  }
}

