import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateStudentEnrollmentTable1767000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'student_enrollments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()'
          },
          {
            name: 'studentId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'classId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'enrollmentDate',
            type: 'date',
            isNullable: false
          },
          {
            name: 'withdrawalDate',
            type: 'date',
            isNullable: true
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true
          },
          {
            name: 'enrolledByUserId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'withdrawnByUserId',
            type: 'uuid',
            isNullable: true
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      'student_enrollments',
      new TableIndex({
        name: 'IDX_student_enrollments_student_date',
        columnNames: ['studentId', 'enrollmentDate']
      })
    );

    await queryRunner.createIndex(
      'student_enrollments',
      new TableIndex({
        name: 'IDX_student_enrollments_class',
        columnNames: ['classId']
      })
    );

    await queryRunner.createIndex(
      'student_enrollments',
      new TableIndex({
        name: 'IDX_student_enrollments_active',
        columnNames: ['isActive']
      })
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'student_enrollments',
      new TableForeignKey({
        columnNames: ['studentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'students',
        onDelete: 'CASCADE'
      })
    );

    await queryRunner.createForeignKey(
      'student_enrollments',
      new TableForeignKey({
        columnNames: ['classId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'classes',
        onDelete: 'CASCADE'
      })
    );

    await queryRunner.createForeignKey(
      'student_enrollments',
      new TableForeignKey({
        columnNames: ['enrolledByUserId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'RESTRICT'
      })
    );

    await queryRunner.createForeignKey(
      'student_enrollments',
      new TableForeignKey({
        columnNames: ['withdrawnByUserId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL'
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('student_enrollments', true);
  }
}

