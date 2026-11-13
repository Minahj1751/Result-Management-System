const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

/**
 * Generate PDF from HTML template
 */
const generatePDF = async (html, outputPath) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    await browser.close();

    return outputPath;
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
};

/**
 * Generate marksheet HTML
 */
const generateMarksheetHTML = async (data) => {
  const {
    student,
    enrollment,
    attendance,
    schoolSettings,
    snapshots,
  } = data;

  // Calculate attendance percentage
  let attendancePercentage = '';
  if (attendance && attendance.totalWorkingDays > 0) {
    const percentage = ((attendance.daysAttended / attendance.totalWorkingDays) * 100).toFixed(2);
    if (schoolSettings?.showAttendancePercentage) {
      attendancePercentage = `(${percentage}%)`;
    }
  }

  const attendanceText = attendance
    ? `${attendance.daysAttended}/${attendance.totalWorkingDays}`
    : 'N/A';

  // Build category headers
  const categories = {};
  snapshots.forEach((snapshot) => {
    const jsonData = JSON.parse(snapshot.jsonData || '{}');
    if (jsonData.categoryResults) {
      Object.keys(jsonData.categoryResults).forEach((categoryCode) => {
        if (!categories[categoryCode]) {
          categories[categoryCode] = {
            name: jsonData.categoryResults[categoryCode].categoryName,
            weightage: jsonData.categoryResults[categoryCode].categoryWeightage,
            assessments: [],
          };
        }
        jsonData.categoryResults[categoryCode].assessments.forEach((assessment) => {
          if (!categories[categoryCode].assessments.includes(assessment.name)) {
            categories[categoryCode].assessments.push(assessment.name);
          }
        });
      });
    }
  });

  const categoryHeaders = Object.values(categories)
    .map((cat) => `<th colspan="${cat.assessments.length}" class="category-header">${cat.name} (${cat.weightage}%)</th>`)
    .join('');

  const assessmentHeaders = Object.values(categories)
    .map((cat) => cat.assessments.map((ass) => `<th>${ass}</th>`).join(''))
    .join('');

  // Build subject rows
  const subjectRows = snapshots.map((snapshot) => {
    const jsonData = JSON.parse(snapshot.jsonData || '{}');
    let marksCells = '';

    Object.values(categories).forEach((cat) => {
      cat.assessments.forEach((assessmentName) => {
        let markDisplay = '-';
        if (jsonData.categoryResults && jsonData.categoryResults[cat.name.replace(/\s/g, '')]) {
          const category = jsonData.categoryResults[cat.name.replace(/\s/g, '')];
          const assessment = category.assessments.find((a) => a.name === assessmentName);
          if (assessment) {
            if (assessment.status === 'ABSENT') {
              markDisplay = 'A';
            } else if (assessment.status === 'EXEMPTED') {
              markDisplay = 'E';
            } else if (assessment.status === 'NOT_APPLICABLE') {
              markDisplay = 'N/A';
            } else if (assessment.marksObtained !== null) {
              markDisplay = assessment.marksObtained.toFixed(schoolSettings?.decimalPrecision || 2);
            }
          }
        }
        marksCells += `<td>${markDisplay}</td>`;
      });
    });

    return `
      <tr>
        <td class="subject-name">${snapshot.subject.name}</td>
        ${marksCells}
      </tr>
    `;
  }).join('');

  let html = await fs.readFile(
    path.join(__dirname, '../templates/marksheet/template.html'),
    'utf-8'
  );

  // Replace placeholders
  html = html.replace('{{SCHOOL_NAME}}', schoolSettings?.schoolName || 'The New School Dhaka');
  html = html.replace('{{SESSION_LABEL}}', schoolSettings?.sessionLabel || 'Academic Session');
  html = html.replace('{{ACADEMIC_SESSION}}', enrollment?.academicSession?.name || '');
  html = html.replace('{{SEMESTER_LABEL}}', schoolSettings?.semesterLabel || 'Semester');
  html = html.replace('{{SEMESTER}}', enrollment?.semester?.name || '');
  html = html.replace('{{STUDENT_NAME}}', student?.fullName || '');
  html = html.replace('{{CLASS}}', enrollment?.schoolClass?.name || '');
  html = html.replace('{{SECTION}}', enrollment?.section?.name || '');
  html = html.replace('{{ROLL_NUMBER}}', enrollment?.rollNumber || '');
  html = html.replace('{{ATTENDANCE}}', attendanceText);
  html = html.replace('{{ATTENDANCE_PERCENTAGE}}', attendancePercentage);
  html = html.replace('{{REPORT_DATE}}', new Date().toLocaleDateString(schoolSettings?.dateFormat || 'en-GB'));
  html = html.replace('{{CATEGORY_HEADERS}}', categoryHeaders);
  html = html.replace('{{ASSESSMENT_HEADERS}}', assessmentHeaders);
  html = html.replace('{{SUBJECT_ROWS}}', subjectRows);
  html = html.replace('{{PRINCIPAL_SIGNATURE}}', schoolSettings?.principalSignature || 'Principal');
  html = html.replace('{{CLASS_TEACHER_SIGNATURE}}', schoolSettings?.classTeacherSignature || 'Class Teacher');

  return html;
};

/**
 * Generate individual student marksheet PDF
 */
const generateStudentMarksheetPDF = async (data, outputPath) => {
  const html = await generateMarksheetHTML(data);
  return await generatePDF(html, outputPath);
};

/**
 * Generate ZIP archive of marksheets for entire class
 */
const generateClassMarksheetsZIP = async (studentsData, outputPath) => {
  const output = require('fs').createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise(async (resolve, reject) => {
    output.on('close', () => {
      resolve(outputPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Generate PDFs sequentially
    for (const studentData of studentsData) {
      try {
        const html = await generateMarksheetHTML(studentData);
        const pdfPath = path.join(
          path.dirname(outputPath),
          `temp_${studentData.student.studentId}.pdf`
        );

        await generatePDF(html, pdfPath);

        const pdfBuffer = await fs.readFile(pdfPath);
        archive.append(pdfBuffer, {
          name: `${studentData.student.studentId}_${studentData.student.fullName.replace(/\s+/g, '_')}.pdf`,
        });

        await fs.unlink(pdfPath);
      } catch (error) {
        console.error('Error generating PDF for student:', studentData.student.studentId, error);
      }
    }

    archive.finalize();
  });
};

module.exports = {
  generatePDF,
  generateMarksheetHTML,
  generateStudentMarksheetPDF,
  generateClassMarksheetsZIP,
};
