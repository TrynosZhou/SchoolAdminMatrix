import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../entities/User';
import {
  registerStudent,
  getStudents,
  getStudentById,
  enrollStudent,
  updateStudent,
  deleteStudent,
  promoteStudents,
  generateStudentIdCard,
  getDHServicesReport,
  getTransportServicesReport
} from '../controllers/student.controller';
import { upload } from '../utils/upload';

const router = Router();

router.post('/', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DEMO_USER), upload.single('photo'), registerStudent);
router.get('/', authenticate, getStudents);
// Enrollment is now handled by /api/enrollments endpoint
// router.post('/enroll', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DEMO_USER), enrollStudent);
router.post('/promote', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DEMO_USER), promoteStudents);
router.get('/reports/dh-services', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN), getDHServicesReport);
router.get('/reports/transport-services', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN), getTransportServicesReport);
router.get('/:id/id-card', authenticate, generateStudentIdCard);
router.get('/:id', authenticate, getStudentById);
router.put('/:id', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DEMO_USER), upload.single('photo'), updateStudent);
router.delete('/:id', authenticate, authorize(UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DEMO_USER), deleteStudent);

export default router;

