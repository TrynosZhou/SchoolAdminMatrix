import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-student-dashboard',
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.css']
})
export class StudentDashboardComponent implements OnInit {
  studentName = '';
  studentNumber = '';
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    const user = this.authService.getCurrentUser();
    if (user?.student) {
      this.studentName = `${user.student.firstName || ''} ${user.student.lastName || ''}`.trim() || 'Student';
      this.studentNumber = user.student.studentNumber || '';
    } else {
      this.studentName = 'Student';
    }
  }

  ngOnInit() {
    // Verify user is a student
    const user = this.authService.getCurrentUser();
    if (!user || user.role !== 'student') {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  viewReportCard() {
    this.router.navigate(['/student/report-card']);
  }

  viewInvoiceStatement() {
    this.router.navigate(['/student/invoice-statement']);
  }

  logout() {
    if (confirm('Are you sure you want to logout?')) {
      this.authService.logout();
    }
  }
}

