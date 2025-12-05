import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EnrollmentService } from '../../../services/enrollment.service';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-unenrolled-students',
  templateUrl: './unenrolled-students.component.html',
  styleUrls: ['./unenrolled-students.component.css']
})
export class UnenrolledStudentsComponent implements OnInit {
  students: any[] = [];
  filteredStudents: any[] = [];
  paginatedStudents: any[] = [];
  loading = false;
  error = '';
  searchQuery = '';
  pagination = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  };
  pageSizeOptions = [10, 20, 50, 100];

  constructor(
    private enrollmentService: EnrollmentService,
    private studentService: StudentService,
    public router: Router
  ) { }

  ngOnInit() {
    this.loadUnenrolledStudents();
  }

  loadUnenrolledStudents() {
    this.loading = true;
    this.error = '';
    // Try enrollment service first, fallback to student service with status filter
    this.enrollmentService.getUnenrolledStudents().subscribe({
      next: (data: any) => {
        this.students = data || [];
        this.filteredStudents = this.students;
        this.pagination.total = this.filteredStudents.length;
        this.pagination.totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
        this.pagination.page = 1;
        this.updatePaginatedStudents();
        this.loading = false;
      },
      error: (err: any) => {
        // Fallback to student service
        this.studentService.getStudents({ enrollmentStatus: 'Not Enrolled' }).subscribe({
          next: (data: any) => {
            this.students = data || [];
            this.filteredStudents = this.students;
            this.pagination.total = this.filteredStudents.length;
            this.pagination.totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
            this.pagination.page = 1;
            this.updatePaginatedStudents();
            this.loading = false;
          },
          error: (err2: any) => {
            console.error('Error loading unenrolled students:', err2);
            this.error = 'Failed to load unenrolled students';
            this.loading = false;
            setTimeout(() => this.error = '', 5000);
          }
        });
      }
    });
  }

  filterStudents() {
    if (!this.searchQuery.trim()) {
      this.filteredStudents = this.students;
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredStudents = this.students.filter((s: any) =>
        s.studentNumber?.toLowerCase().includes(query) ||
        s.firstName?.toLowerCase().includes(query) ||
        s.lastName?.toLowerCase().includes(query) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(query)
      );
    }
    this.pagination.total = this.filteredStudents.length;
    this.pagination.totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
    this.pagination.page = 1;
    this.updatePaginatedStudents();
  }

  updatePaginatedStudents() {
    const start = (this.pagination.page - 1) * this.pagination.limit;
    const end = start + this.pagination.limit;
    this.paginatedStudents = this.filteredStudents.slice(start, end);
  }

  changePage(page: number) {
    if (page < 1 || page > this.pagination.totalPages || page === this.pagination.page) {
      return;
    }
    this.pagination.page = page;
    this.updatePaginatedStudents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  changePageSize(limit: string | number) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    if (!parsedLimit || parsedLimit === this.pagination.limit) return;
    this.pagination.limit = parsedLimit;
    this.pagination.totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
    this.pagination.page = 1;
    this.updatePaginatedStudents();
  }

  enrollStudent(studentId: string) {
    this.router.navigate(['/enrollments/new'], { queryParams: { studentId } });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

