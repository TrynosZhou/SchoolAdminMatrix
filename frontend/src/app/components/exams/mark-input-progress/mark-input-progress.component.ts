import { Component, OnInit } from '@angular/core';
import { ExamService } from '../../../services/exam.service';
import { ClassService } from '../../../services/class.service';
import { SubjectService } from '../../../services/subject.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-mark-input-progress',
  templateUrl: './mark-input-progress.component.html',
  styleUrls: ['./mark-input-progress.component.css']
})
export class MarkInputProgressComponent implements OnInit {
  classes: any[] = [];
  subjects: any[] = [];
  exams: any[] = [];
  
  selectedExamId = '';
  selectedSubjectId = '';
  selectedSubjectCode = '';
  selectedTerm = '';
  selectedExamType = '';
  
  progressData: any = null;
  loading = false;
  error = '';
  
  examTypes = [
    { value: 'mid_term', label: 'Mid Term' },
    { value: 'end_term', label: 'End Term' }
  ];
  
  constructor(
    private examService: ExamService,
    private classService: ClassService,
    private subjectService: SubjectService,
    private settingsService: SettingsService
  ) { }

  ngOnInit() {
    this.loadSettings();
    this.loadClasses();
    this.loadSubjects();
    this.loadExams();
  }

  loadSettings() {
    this.settingsService.getSettings().subscribe({
      next: (settings: any) => {
        if (settings) {
          // Use activeTerm from settings, or fallback to currentTerm
          this.selectedTerm = settings.activeTerm || settings.currentTerm || '';
        }
      },
      error: (error) => {
        console.error('Error loading settings:', error);
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

  loadSubjects() {
    this.subjectService.getSubjects().subscribe(
      (data: any) => {
        // Filter active subjects and ensure code is included
        this.subjects = data.filter((s: any) => s.isActive).map((s: any) => ({
          ...s,
          displayName: s.code ? `${s.code} - ${s.name}` : s.name
        }));
      },
      (error: any) => {
        console.error('Error loading subjects:', error);
        this.error = 'Failed to load subjects';
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
  }

  onSubjectCodeChange() {
    // Sync subject ID when subject is selected by code
    const selectedSubject = this.subjects.find(s => s.code === this.selectedSubjectCode);
    if (selectedSubject) {
      this.selectedSubjectId = selectedSubject.id;
    } else {
      this.selectedSubjectId = '';
    }
  }

  loadExams() {
    this.examService.getExams().subscribe(
      (data: any) => {
        this.exams = data;
        // Extract unique terms
        const terms = new Set(data.map((e: any) => e.term).filter((t: any) => t));
        // You can use this for term selection if needed
      },
      (error: any) => {
        console.error('Error loading exams:', error);
      }
    );
  }

  loadProgress() {
    this.loading = true;
    this.error = '';
    this.progressData = null;

    this.examService.getMarkInputProgress(
      this.selectedExamId || undefined,
      this.selectedSubjectId || undefined,
      this.selectedTerm || undefined,
      this.selectedExamType || undefined
    ).subscribe(
      (data: any) => {
        this.progressData = data;
        this.loading = false;
      },
      (error: any) => {
        console.error('Error loading progress:', error);
        this.error = error.error?.message || 'Failed to load progress data';
        this.loading = false;
      }
    );
  }

  resetFilters() {
    this.selectedExamId = '';
    this.selectedSubjectId = '';
    this.selectedSubjectCode = '';
    this.selectedExamType = '';
    // Reload term from settings when resetting
    this.loadSettings();
    this.progressData = null;
  }

  getProgressColor(percentage: number): string {
    if (percentage >= 80) return '#28a745';
    if (percentage >= 50) return '#ffc107';
    if (percentage >= 25) return '#fd7e14';
    return '#dc3545';
  }

  getProgressWidth(percentage: number): string {
    return `${Math.min(100, Math.max(0, percentage))}%`;
  }
}

