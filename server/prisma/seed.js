const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Hash password for admin
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@newschooldhaka.edu' },
    update: {},
    create: {
      email: 'admin@newschooldhaka.edu',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Created admin user:', admin.email);

  // Create academic sessions
  const session2025 = await prisma.academicSession.upsert({
    where: { name: '2025-26' },
    update: {},
    create: {
      name: '2025-26',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    },
  });

  const session2026 = await prisma.academicSession.upsert({
    where: { name: '2026-27' },
    update: {},
    create: {
      name: '2026-27',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-12-31'),
      isActive: false,
    },
  });

  console.log('Created academic sessions');

  // Create semesters
  const firstTerm = await prisma.semester.upsert({
    where: {
      name_academicSessionId: {
        name: 'First Term',
        academicSessionId: session2025.id,
      },
    },
    update: {},
    create: {
      name: 'First Term',
      academicSessionId: session2025.id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-06-30'),
      isActive: true,
    },
  });

  const secondTerm = await prisma.semester.upsert({
    where: {
      name_academicSessionId: {
        name: 'Second Term',
        academicSessionId: session2025.id,
      },
    },
    update: {},
    create: {
      name: 'Second Term',
      academicSessionId: session2025.id,
      startDate: new Date('2025-07-01'),
      endDate: new Date('2025-12-31'),
      isActive: false,
    },
  });

  console.log('Created semesters');

  // Create school classes
  const classes = [];
  for (let i = 1; i <= 10; i++) {
    const schoolClass = await prisma.schoolClass.upsert({
      where: { name: `Grade ${i}` },
      update: {},
      create: {
        name: `Grade ${i}`,
        sortOrder: i,
      },
    });
    classes.push(schoolClass);
  }

  console.log('Created school classes');

  // Create sections
  const sections = [];
  for (const schoolClass of classes) {
    for (const sectionName of ['A', 'B']) {
      const section = await prisma.section.upsert({
        where: {
          name_schoolClassId: {
            name: sectionName,
            schoolClassId: schoolClass.id,
          },
        },
        update: {},
        create: {
          name: sectionName,
          schoolClassId: schoolClass.id,
        },
      });
      sections.push(section);
    }
  }

  console.log('Created sections');

  // Create subjects
  const subjects = [
    'English Language',
    'English Literature',
    'Bangla',
    'Mathematics',
    'History & Geography',
    'ICT & AI',
    'Spelling & Dictation',
    'Science',
    'Art & Craft',
    'Bangladesh Studies',
  ];

  const createdSubjects = [];
  for (let i = 0; i < subjects.length; i++) {
    const subjectName = subjects[i];
    const subject = await prisma.subject.upsert({
      where: { name: subjectName },
      update: {},
      create: {
        name: subjectName,
        code: `SUB${String(i + 1).padStart(2, '0')}`,
      },
    });
    createdSubjects.push(subject);
  }

  console.log('Created subjects');

  // Create assessment categories
  const classTestCategory = await prisma.assessmentCategory.upsert({
    where: { code: 'CT' },
    update: {},
    create: {
      name: 'Class Test',
      code: 'CT',
      weightage: 20.0,
      description: 'Class Test assessments',
    },
  });

  const classworkCategory = await prisma.assessmentCategory.upsert({
    where: { code: 'CW' },
    update: {},
    create: {
      name: 'Classwork',
      code: 'CW',
      weightage: 10.0,
      description: 'Classwork assessments',
    },
  });

  const homeworkCategory = await prisma.assessmentCategory.upsert({
    where: { code: 'HW' },
    update: {},
    create: {
      name: 'Homework',
      code: 'HW',
      weightage: 10.0,
      description: 'Homework assessments',
    },
  });

  console.log('Created assessment categories');

  // Create teachers
  const teacherPasswordHash = await bcrypt.hash('Teacher@123', 10);

  const teacher1 = await prisma.user.upsert({
    where: { email: 'teacher1@newschooldhaka.edu' },
    update: {},
    create: {
      email: 'teacher1@newschooldhaka.edu',
      passwordHash: teacherPasswordHash,
      role: 'SUBJECT_TEACHER',
      isActive: true,
      teacherProfile: {
        create: {
          fullName: 'John Smith',
          employeeId: 'EMP001',
          phone: '+8801712345678',
          designation: 'Senior Teacher',
        },
      },
    },
    include: {
      teacherProfile: true,
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: 'teacher2@newschooldhaka.edu' },
    update: {},
    create: {
      email: 'teacher2@newschooldhaka.edu',
      passwordHash: teacherPasswordHash,
      role: 'CLASS_TEACHER',
      isActive: true,
      teacherProfile: {
        create: {
          fullName: 'Jane Doe',
          employeeId: 'EMP002',
          phone: '+8801712345679',
          designation: 'Class Teacher',
        },
      },
    },
    include: {
      teacherProfile: true,
    },
  });

  const teacher3 = await prisma.user.upsert({
    where: { email: 'teacher3@newschooldhaka.edu' },
    update: {},
    create: {
      email: 'teacher3@newschooldhaka.edu',
      passwordHash: teacherPasswordHash,
      role: 'SUBJECT_TEACHER',
      isActive: true,
      teacherProfile: {
        create: {
          fullName: 'Robert Johnson',
          employeeId: 'EMP003',
          phone: '+8801712345680',
          designation: 'Subject Teacher',
        },
      },
    },
    include: {
      teacherProfile: true,
    },
  });

  console.log('Created teachers');

  // Create grading policy
  const gradingPolicy = await prisma.gradingPolicy.upsert({
    where: { name: 'Standard Grading Policy' },
    update: {},
    create: {
      name: 'Standard Grading Policy',
      description: 'Standard 10-point grading scale',
      isActive: true,
      gradeScales: {
        create: [
          { minPercentage: 80, maxPercentage: 100, grade: 'A+', gradePoint: 5.0, remarks: 'Excellent' },
          { minPercentage: 70, maxPercentage: 79.99, grade: 'A', gradePoint: 4.0, remarks: 'Very Good' },
          { minPercentage: 60, maxPercentage: 69.99, grade: 'A-', gradePoint: 3.5, remarks: 'Good' },
          { minPercentage: 50, maxPercentage: 59.99, grade: 'B', gradePoint: 3.0, remarks: 'Satisfactory' },
          { minPercentage: 40, maxPercentage: 49.99, grade: 'C', gradePoint: 2.0, remarks: 'Fair' },
          { minPercentage: 33, maxPercentage: 39.99, grade: 'D', gradePoint: 1.0, remarks: 'Pass' },
          { minPercentage: 0, maxPercentage: 32.99, grade: 'F', gradePoint: 0.0, remarks: 'Fail' },
        ],
      },
    },
  });

  console.log('Created grading policy');

  // Create school settings
  await prisma.schoolSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      schoolName: 'The New School Dhaka',
      address: 'Dhaka, Bangladesh',
      sessionLabel: 'Academic Session',
      semesterLabel: 'Semester',
      dateFormat: 'DD/MM/YYYY',
      showAttendancePercentage: true,
      subjectOrdering: 'name',
      assessmentOrdering: 'name',
      decimalPrecision: 2,
      principalSignature: 'Principal',
      classTeacherSignature: 'Class Teacher',
    },
  });

  console.log('Created school settings');

  // Create sample students
  const students = [];
  for (let i = 1; i <= 20; i++) {
    const student = await prisma.student.upsert({
      where: { studentId: `STU${String(i).padStart(5, '0')}` },
      update: {},
      create: {
        studentId: `STU${String(i).padStart(5, '0')}`,
        admissionNumber: `ADM${String(i).padStart(5, '0')}`,
        fullName: `Student ${i}`,
        dateOfBirth: new Date('2010-01-01'),
        guardianName: `Guardian ${i}`,
        guardianPhone: `+8801${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`,
        isActive: true,
      },
    });
    students.push(student);
  }

  console.log('Created students');

  // Enroll students in Grade 3, Section A, First Term
  const grade3 = classes[2]; // Grade 3
  const sectionA = sections[0]; // Section A of Grade 3

  for (let i = 0; i < 10; i++) {
    await prisma.studentEnrollment.upsert({
      where: {
        studentId_academicSessionId_semesterId_schoolClassId_sectionId: {
          studentId: students[i].id,
          academicSessionId: session2025.id,
          semesterId: firstTerm.id,
          schoolClassId: grade3.id,
          sectionId: sectionA.id,
        },
      },
      update: {},
      create: {
        studentId: students[i].id,
        academicSessionId: session2025.id,
        semesterId: firstTerm.id,
        schoolClassId: grade3.id,
        sectionId: sectionA.id,
        rollNumber: i + 1,
        isActive: true,
      },
    });
  }

  console.log('Enrolled students');

  // Assign teacher to subject
  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_subjectId_academicSessionId_semesterId_schoolClassId_sectionId: {
        teacherId: teacher1.teacherProfile.id,
        subjectId: createdSubjects[0].id,
        academicSessionId: session2025.id,
        semesterId: firstTerm.id,
        schoolClassId: grade3.id,
        sectionId: sectionA.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher1.teacherProfile.id,
      subjectId: createdSubjects[0].id, // English Language
      academicSessionId: session2025.id,
      semesterId: firstTerm.id,
      schoolClassId: grade3.id,
      sectionId: sectionA.id,
      isActive: true,
      startDate: new Date('2025-01-01'),
    },
  });

  // Assign class teacher
  await prisma.classTeacherAssignment.upsert({
    where: {
      teacherId_academicSessionId_semesterId_schoolClassId_sectionId: {
        teacherId: teacher2.teacherProfile.id,
        academicSessionId: session2025.id,
        semesterId: firstTerm.id,
        schoolClassId: grade3.id,
        sectionId: sectionA.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher2.teacherProfile.id,
      academicSessionId: session2025.id,
      semesterId: firstTerm.id,
      schoolClassId: grade3.id,
      sectionId: sectionA.id,
      isActive: true,
      startDate: new Date('2025-01-01'),
    },
  });

  console.log('Created teacher assignments');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
