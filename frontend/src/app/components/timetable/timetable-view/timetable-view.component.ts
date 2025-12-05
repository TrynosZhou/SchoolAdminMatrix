import { Component, OnInit } from '@angular/core';
import { TimetableService, TimetableVersion, TimetableSlot } from '../../../services/timetable.service';
import { TeacherService } from '../../../services/teacher.service';
import { ClassService } from '../../../services/class.service';
import { SubjectService } from '../../../services/subject.service';

@Component({
  selector: 'app-timetable-view',
  templateUrl: './timetable-view.component.html',
  styleUrls: ['./timetable-view.component.css']
})
export class TimetableViewComponent implements OnInit {
  versions: TimetableVersion[] = [];
  selectedVersion: TimetableVersion | null = null;
  slots: TimetableSlot[] = [];
  teachers: any[] = [];
  classes: any[] = [];
  subjects: any[] = [];

  viewMode: 'class' | 'teacher' | 'all' = 'all';
  selectedTeacherId: string = '';
  selectedClassId: string = '';

  daysOfWeek: string[] = [];
  periods: number[] = [];
  timetableGrid: Map<string, TimetableSlot[]> = new Map();

  loading = false;
  generating = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  // Generation form
  newVersionName = '';
  newVersionDescription = '';

  // Edit mode
  editingSlot: TimetableSlot | null = null;
  editForm: any = {};

  constructor(
    private timetableService: TimetableService,
    private teacherService: TeacherService,
    private classService: ClassService,
    private subjectService: SubjectService
  ) {}

  ngOnInit(): void {
    this.loadVersions();
    this.loadTeachers();
    this.loadClasses();
    this.loadSubjects();
  }

  loadVersions(): void {
    this.loading = true;
    this.timetableService.getVersions().subscribe({
      next: (versions) => {
        this.versions = versions;
        if (versions.length > 0 && !this.selectedVersion) {
          const activeVersion = versions.find(v => v.isActive) || versions[0];
          this.selectVersion(activeVersion.id);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading versions:', err);
        this.error = 'Failed to load timetable versions';
        this.loading = false;
      }
    });
  }

  loadTeachers(): void {
    this.teacherService.getTeachers().subscribe({
      next: (teachers) => {
        this.teachers = teachers;
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
      }
    });
  }

  loadClasses(): void {
    this.classService.getClasses().subscribe({
      next: (classes) => {
        const classesList = Array.isArray(classes) ? classes : (classes?.data || []);
        this.classes = this.classService.sortClasses(classesList);
      },
      error: (err) => {
        console.error('Error loading classes:', err);
      }
    });
  }

  loadSubjects(): void {
    this.subjectService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
      }
    });
  }

  selectVersion(versionId: string): void {
    this.selectedVersion = this.versions.find(v => v.id === versionId) || null;
    if (this.selectedVersion) {
      this.loadSlots();
    }
  }

  loadSlots(): void {
    if (!this.selectedVersion) return;

    this.loading = true;
    const teacherId: string | undefined = (this.viewMode === 'teacher' && this.selectedTeacherId && this.selectedTeacherId !== '') 
      ? this.selectedTeacherId 
      : undefined;
    const classId: string | undefined = (this.viewMode === 'class' && this.selectedClassId && this.selectedClassId !== '') 
      ? this.selectedClassId 
      : undefined;

    this.timetableService.getSlots(this.selectedVersion.id, teacherId, classId).subscribe({
      next: (slots) => {
        this.slots = slots;
        this.buildTimetableGrid();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading slots:', err);
        this.error = 'Failed to load timetable slots';
        this.loading = false;
      }
    });
  }

  buildTimetableGrid(): void {
    this.timetableGrid.clear();
    
    // Extract unique days and periods
    const daysSet = new Set<string>();
    const periodsSet = new Set<number>();
    
    this.slots.forEach(slot => {
      if (!slot.isBreak) {
        daysSet.add(slot.dayOfWeek);
        periodsSet.add(slot.periodNumber);
      }
    });

    this.daysOfWeek = Array.from(daysSet).sort();
    this.periods = Array.from(periodsSet).sort((a, b) => a - b);

    // Build grid map
    this.slots.forEach(slot => {
      if (!slot.isBreak) {
        const key = `${slot.dayOfWeek}-${slot.periodNumber}`;
        if (!this.timetableGrid.has(key)) {
          this.timetableGrid.set(key, []);
        }
        this.timetableGrid.get(key)!.push(slot);
      }
    });
  }

  getSlot(day: string, period: number): TimetableSlot[] {
    const key = `${day}-${period}`;
    return this.timetableGrid.get(key) || [];
  }

  isSlotBeingEdited(slot: TimetableSlot): boolean {
    return this.editingSlot !== null && this.editingSlot.id === slot.id;
  }

  isCellBeingEdited(day: string, period: number): boolean {
    if (!this.editingSlot) return false;
    const slots = this.getSlot(day, period);
    return slots.some(s => s.id === this.editingSlot!.id);
  }

  isVersionSelected(versionId: string): boolean {
    return this.selectedVersion?.id === versionId;
  }

  generateTimetable(): void {
    if (!this.newVersionName.trim()) {
      this.error = 'Please enter a version name';
      return;
    }

    this.generating = true;
    this.error = null;
    this.success = null;

    this.timetableService.generateTimetable(this.newVersionName, this.newVersionDescription).subscribe({
      next: (response) => {
        this.success = `Timetable generated successfully! ${response.stats.totalSlots} slots created.`;
        this.newVersionName = '';
        this.newVersionDescription = '';
        this.loadVersions();
        this.generating = false;
        setTimeout(() => {
          this.success = null;
        }, 5000);
      },
      error: (err) => {
        console.error('Error generating timetable:', err);
        
        // Build detailed error message with diagnostics
        let errorMessage = err.error?.message || 'Failed to generate timetable';
        
        if (err.error?.diagnostics) {
          const diagnostics = err.error.diagnostics;
          errorMessage += '\n\n';
          
          if (diagnostics.issues && diagnostics.issues.length > 0) {
            errorMessage += 'Issues found:\n';
            diagnostics.issues.forEach((issue: string) => {
              errorMessage += `• ${issue}\n`;
            });
            errorMessage += '\n';
          }
          
          if (err.error?.help && err.error.help.length > 0) {
            errorMessage += 'How to fix:\n';
            err.error.help.forEach((help: string) => {
              errorMessage += `${help}\n`;
            });
          }
          
          // Add summary
          if (diagnostics.teachers) {
            const teachersWithoutClasses = diagnostics.teachers.filter((t: any) => t.classesCount === 0).length;
            const teachersWithoutSubjects = diagnostics.teachers.filter((t: any) => t.subjectsCount === 0).length;
            const classesWithoutSubjects = diagnostics.classes.filter((c: any) => c.subjectsCount === 0).length;
            
            errorMessage += '\nSummary:\n';
            if (teachersWithoutClasses > 0) {
              errorMessage += `• ${teachersWithoutClasses} teacher(s) need classes assigned\n`;
            }
            if (teachersWithoutSubjects > 0) {
              errorMessage += `• ${teachersWithoutSubjects} teacher(s) need subjects assigned\n`;
            }
            if (classesWithoutSubjects > 0) {
              errorMessage += `• ${classesWithoutSubjects} class(es) need subjects assigned\n`;
            }
          }
        }
        
        this.error = errorMessage;
        this.generating = false;
      }
    });
  }

  activateVersion(versionId: string): void {
    this.timetableService.activateVersion(versionId).subscribe({
      next: () => {
        this.success = 'Timetable version activated successfully';
        this.loadVersions();
        // Auto-select the activated version
        this.selectVersion(versionId);
        setTimeout(() => {
          this.success = null;
        }, 3000);
      },
      error: (err) => {
        console.error('Error activating version:', err);
        this.error = err.error?.message || 'Failed to activate timetable version';
      }
    });
  }

  editSlot(slot: TimetableSlot): void {
    this.editingSlot = { ...slot };
    this.editForm = {
      teacherId: slot.teacherId,
      classId: slot.classId,
      subjectId: slot.subjectId,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      room: slot.room || ''
    };
  }

  cancelEdit(): void {
    this.editingSlot = null;
    this.editForm = {};
  }

  saveSlot(): void {
    if (!this.editingSlot) return;

    this.saving = true;
    this.timetableService.updateSlot(this.editingSlot.id, this.editForm).subscribe({
      next: () => {
        this.success = 'Timetable slot updated successfully';
        this.cancelEdit();
        this.loadSlots();
        this.saving = false;
        setTimeout(() => {
          this.success = null;
        }, 3000);
      },
      error: (err) => {
        console.error('Error updating slot:', err);
        this.error = err.error?.message || 'Failed to update timetable slot';
        if (err.error?.conflicts) {
          this.error += ' Conflicts detected.';
        }
        this.saving = false;
      }
    });
  }

  deleteSlot(slotId: string): void {
    if (!confirm('Are you sure you want to delete this timetable slot?')) {
      return;
    }

    this.timetableService.deleteSlot(slotId).subscribe({
      next: () => {
        this.success = 'Timetable slot deleted successfully';
        this.loadSlots();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      },
      error: (err) => {
        console.error('Error deleting slot:', err);
        this.error = 'Failed to delete timetable slot';
      }
    });
  }

  downloadTeacherPDF(teacherId: string): void {
    if (!this.selectedVersion) return;

    this.timetableService.downloadTeacherTimetablePDF(this.selectedVersion.id, teacherId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teacher-timetable-${teacherId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading PDF:', err);
        this.error = 'Failed to download teacher timetable PDF';
      }
    });
  }

  downloadClassPDF(classId: string): void {
    if (!this.selectedVersion) return;

    this.timetableService.downloadClassTimetablePDF(this.selectedVersion.id, classId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `class-timetable-${classId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading PDF:', err);
        this.error = 'Failed to download class timetable PDF';
      }
    });
  }

  downloadConsolidatedPDF(versionId?: string): void {
    const targetVersionId = versionId || this.selectedVersion?.id;
    if (!targetVersionId) {
      this.error = 'Please select a timetable version first';
      return;
    }

    this.timetableService.downloadConsolidatedTimetablePDF(targetVersionId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consolidated-timetable-${targetVersionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.success = 'PDF downloaded successfully';
        setTimeout(() => {
          this.success = null;
        }, 3000);
      },
      error: (err) => {
        console.error('Error downloading PDF:', err);
        this.error = err.error?.message || 'Failed to download consolidated timetable PDF';
      }
    });
  }

  onViewModeChange(): void {
    this.loadSlots();
  }

  clearError(): void {
    this.error = null;
  }

  clearSuccess(): void {
    this.success = null;
  }
}

