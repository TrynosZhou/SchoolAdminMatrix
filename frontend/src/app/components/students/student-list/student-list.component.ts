import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { StudentService } from '../../../services/student.service';
import { ClassService } from '../../../services/class.service';

@Component({
  selector: 'app-student-list',
  templateUrl: './student-list.component.html',
  styleUrls: ['./student-list.component.css']
})
export class StudentListComponent implements OnInit {
  students: any[] = [];
  filteredStudents: any[] = [];
  classes: any[] = [];
  selectedClass = '';
  selectedType = '';
  selectedGender = '';
  searchQuery = '';
  viewMode: 'grid' | 'list' = 'grid';
  loading = false;
  error = '';
  success = '';
  selectedStudent: any = null;
  pagination = {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1
  };
  pageSizeOptions = [12, 24, 48];
  private searchDebounceTimer: any = null;

  constructor(
    private studentService: StudentService,
    private classService: ClassService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadClasses();
    this.loadStudents();
  }

  loadClasses() {
    this.classService.getClasses().subscribe({
      next: (data: any) => {
        this.classes = data || [];
      },
      error: (err: any) => {
        console.error('Error loading classes:', err);
      }
    });
  }

  loadStudents() {
    this.loading = true;
    this.studentService.getStudents({
      classId: this.selectedClass || undefined,
      studentType: this.selectedType || undefined,
      gender: this.selectedGender || undefined,
      search: this.searchQuery || undefined,
      page: this.pagination.page,
      limit: this.pagination.limit
    }).subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.students = response;
          this.pagination.total = response.length;
          this.pagination.totalPages = 1;
        } else {
          this.students = response?.data || [];
          this.pagination.total = response?.total || this.students.length;
          this.pagination.totalPages = response?.totalPages || 1;
        }
        this.filteredStudents = this.students;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Error loading students:', err);
        this.error = 'Failed to load students';
        this.loading = false;
        this.students = [];
        this.filteredStudents = [];
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  filterStudents() {
    this.pagination.page = 1;
    this.loadStudents();
  }

  onSearchInput() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.pagination.page = 1;
      this.loadStudents();
    }, 400);
  }

  clearFilters() {
    this.searchQuery = '';
    this.selectedClass = '';
    this.selectedType = '';
    this.selectedGender = '';
    this.pagination.page = 1;
    this.loadStudents();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedClass || this.selectedType || this.selectedGender);
  }

  viewStudentDetails(student: any) {
    this.selectedStudent = student;
  }

  closeStudentDetails() {
    this.selectedStudent = null;
  }

  editStudent(id: string) {
    this.router.navigate([`/students/${id}/edit`]);
  }

  viewReportCard(studentId: string) {
    this.router.navigate(['/report-cards'], { queryParams: { studentId } });
  }

  getEnrollmentStatus(student: any): string {
    if (student.classId || student.class?.id || student.classEntity?.id) {
      return 'Enrolled';
    }
    return 'Not Enrolled';
  }

  getEnrollmentStatusClass(student: any): string {
    return this.getEnrollmentStatus(student) === 'Enrolled' ? 'status-enrolled' : 'status-not-enrolled';
  }

  getClassName(student: any): string {
    if (student.classEntity?.name) return student.classEntity.name;
    if (student.class?.name) return student.class.name;
    return 'N/A';
  }

  viewStudentIdCard(studentId: string) {
    if (!studentId) {
      return;
    }

    this.loading = true;
    this.error = '';
    this.studentService.getStudentIdCard(studentId).subscribe({
      next: (blob: Blob) => {
        this.loading = false;
        const fileURL = window.URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
        // Clean up the object URL after a delay
        setTimeout(() => window.URL.revokeObjectURL(fileURL), 100);
      },
      error: (err: any) => {
        this.loading = false;
        console.error('Error loading student ID card:', err);
        console.error('Error details:', {
          status: err.status,
          statusText: err.statusText,
          error: err.error,
          message: err.message
        });
        
        let errorMessage = 'Failed to load student ID card';
        
        // Handle different error types
        if (err.status === 403) {
          const errorObj = typeof err.error === 'string' ? JSON.parse(err.error) : err.error;
          errorMessage = errorObj?.message || 'You do not have permission to view this student\'s ID card. Please ensure you have the required role (Admin, Super Admin, Accountant, or Teacher).';
          
          // Add user role info if available
          if (errorObj?.userRole) {
            errorMessage += ` Your current role: ${errorObj.userRole}.`;
          }
        } else if (err.status === 404) {
          errorMessage = 'Student not found';
        } else if (err.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (err.status === 0 || err.status === undefined) {
          errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 3001.';
        } else if (err.error) {
          if (typeof err.error === 'object' && err.error.message) {
            errorMessage = err.error.message;
          } else if (typeof err.error === 'string') {
            try {
              const parsed = JSON.parse(err.error);
              errorMessage = parsed.message || errorMessage;
            } catch (e) {
              errorMessage = err.error;
            }
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        this.error = errorMessage;
        setTimeout(() => {
          if (this.error === errorMessage) {
            this.error = '';
          }
        }, 7000);
      }
    });
  }

  changePage(page: number) {
    if (page < 1 || page > this.pagination.totalPages || page === this.pagination.page) {
      return;
    }
    this.pagination.page = page;
    this.loadStudents();
  }

  changePageSize(limit: string | number) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    if (!parsedLimit || parsedLimit === this.pagination.limit) {
      return;
    }
    this.pagination.limit = parsedLimit;
    this.pagination.page = 1;
    this.loadStudents();
  }

  deleteStudent(id: string, studentName: string, studentNumber: string) {
    if (!confirm(`Are you sure you want to delete student "${studentName}" (${studentNumber})? This will also delete all marks, invoices, and associated user account. This action cannot be undone.`)) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.success = '';
    this.studentService.deleteStudent(id).subscribe({
      next: (data: any) => {
        this.success = data.message || 'Student deleted successfully';
        this.loading = false;
        this.loadStudents();
        setTimeout(() => this.success = '', 5000);
      },
      error: (err: any) => {
        console.error('Error deleting student:', err);
        let errorMessage = 'Failed to delete student';
        if (err.status === 0 || err.status === undefined) {
          errorMessage = 'Cannot connect to server. Please ensure the backend server is running on port 3001.';
        } else if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        this.error = errorMessage;
        this.loading = false;
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  getStudentsByClass(): any[] {
    const classSet = new Set();
    this.students.forEach(student => {
      if (student.classId || student.class?.id) {
        classSet.add(student.classId || student.class?.id);
      }
    });
    return Array.from(classSet);
  }

  getDayScholarsCount(): number {
    return this.students.filter(s => (s.studentType || 'Day Scholar') === 'Day Scholar').length;
  }

  getBoardersCount(): number {
    return this.students.filter(s => s.studentType === 'Boarder').length;
  }
}
