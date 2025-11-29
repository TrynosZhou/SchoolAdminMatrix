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
  loading = false;
  error = '';
  searchQuery = '';

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
        this.loading = false;
      },
      error: (err: any) => {
        // Fallback to student service
        this.studentService.getStudents({ enrollmentStatus: 'Not Enrolled' }).subscribe({
          next: (data: any) => {
            this.students = data || [];
            this.filteredStudents = this.students;
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
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredStudents = this.students.filter((s: any) =>
      s.studentNumber?.toLowerCase().includes(query) ||
      s.firstName?.toLowerCase().includes(query) ||
      s.lastName?.toLowerCase().includes(query) ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(query)
    );
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

