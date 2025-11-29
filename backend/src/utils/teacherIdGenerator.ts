import { AppDataSource } from '../config/database';
import { Teacher } from '../entities/Teacher';
import { Settings } from '../entities/Settings';

/**
 * Generates a unique 7-digit random teacher ID with prefix from settings
 * Format: {PREFIX}1234567, {PREFIX}9876543, etc. (random 7-digit numbers)
 * Default prefix: JPST (if not configured in settings)
 */
export async function generateTeacherId(): Promise<string> {
  // Ensure database is initialized
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const teacherRepository = AppDataSource.getRepository(Teacher);
  const settingsRepository = AppDataSource.getRepository(Settings);
  
  // Get prefix from settings, default to 'JPST' if not found
  let prefix = 'JPST';
  try {
    const settings = await settingsRepository.findOne({
      where: {},
      order: { createdAt: 'DESC' }
    });
    if (settings && settings.teacherIdPrefix) {
      prefix = settings.teacherIdPrefix.trim();
    }
  } catch (error) {
    console.warn('Could not load settings for teacher ID prefix, using default:', error);
  }

  // Sanitize prefix to uppercase letters/numbers only and ensure it's not empty
  prefix = prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!prefix) {
    prefix = 'JPST';
  }
  
  // Generate random 7-digit number and check uniqueness
  let attempts = 0;
  let teacherId: string;
  let existing: Teacher | null;
  
  do {
    // Generate random 7-digit number (1000000 to 9999999)
    const randomNumber = Math.floor(Math.random() * 9000000) + 1000000;
    const formattedNumber = randomNumber.toString().padStart(7, '0');
    teacherId = `${prefix}${formattedNumber}`;
    
    // Check if this teacher ID already exists
    existing = await teacherRepository.findOne({ 
      where: { teacherId } 
    });
    
    attempts++;
    
    // Safety check to prevent infinite loop
    if (attempts > 100) {
      throw new Error('Unable to generate unique teacher ID after multiple attempts');
    }
  } while (existing);

  return teacherId;
}

