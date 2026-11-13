const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const prisma = require('../config/database');
const resultCalculationService = require('./resultCalculationService');

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

  const safeParse = (str) => {
    try {
      return JSON.parse(str || '{}');
    } catch {
      return {};
    }
  };

  // Build category headers
  const categories = {};
  snapshots.forEach((snapshot) => {
    const jsonData = safeParse(snapshot.jsonData);
    if (jsonData.categoryResults) {
      Object.keys(jsonData.categoryResults).forEach((categoryCode) => {
        if (!categories[categoryCode]) {
          categories[categoryCode] = {
            code: categoryCode,
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

  const categoryList = Object.values(categories);
  const totalAssessmentCols = categoryList.reduce((sum, c) => sum + c.assessments.length, 0);

  const categoryHeaders = categoryList
    .map((cat) => `<th colspan="${cat.assessments.length}" class="category-header">${cat.name} (${cat.weightage}%)</th>`)
    .join('');

  const assessmentHeaders = categoryList
    .map((cat) => cat.assessments.map((ass) => `<th>${ass}</th>`).join(''))
    .join('');

  // Build subject rows
  const subjectRows = snapshots.map((snapshot) => {
    const jsonData = safeParse(snapshot.jsonData);
    let marksCells = '';

    categoryList.forEach((cat) => {
      cat.assessments.forEach((assessmentName) => {
        let markDisplay = '-';
        const categoryResults = jsonData.categoryResults || {};
        // Match by category code key first, then by category name fallback
        const category = Object.values(categoryResults).find(
          (c) => c.categoryName === cat.name || c.categoryCode === cat.code
        );
        if (category) {
          const assessment = category.assessments.find((a) => a.name === assessmentName);
          if (assessment) {
            if (assessment.status === 'ABSENT') {
              markDisplay = 'A';
            } else if (assessment.status === 'EXEMPTED') {
              markDisplay = 'E';
            } else if (assessment.status === 'NOT_APPLICABLE') {
              markDisplay = 'N/A';
            } else if (assessment.marksObtained !== null && assessment.marksObtained !== undefined) {
              markDisplay = Number(assessment.marksObtained).toFixed(schoolSettings?.decimalPrecision || 2);
            }
          }
        }
        marksCells += `<td>${markDisplay}</td>`;
      });
    });

    const pctDisplay = snapshot.percentage !== null && snapshot.percentage !== undefined
      ? `${Number(snapshot.percentage).toFixed(schoolSettings?.decimalPrecision || 2)}%`
      : '-';
    const gpDisplay = snapshot.gradePoint !== null && snapshot.gradePoint !== undefined
      ? Number(snapshot.gradePoint).toFixed(2)
      : '-';

    return `
      <tr>
        <td class="subject-name">${snapshot.subject.name}</td>
        ${marksCells}
        <td class="result-cell">${pctDisplay}</td>
        <td class="result-cell">${snapshot.grade || '-'}</td>
        <td class="result-cell">${gpDisplay}</td>
      </tr>
    `;
  }).join('');

  // Overall summary across subjects
  const summary = resultCalculationService.computeOverallSummary(snapshots);

  // Resolve overall grade from the active grading policy
  let overallGrade = '';
  if (summary.averagePercentage !== null) {
    const policy = await prisma.gradingPolicy.findFirst({
      where: { isActive: true },
      include: { gradeScales: { orderBy: { minPercentage: 'desc' } } },
    });
    if (policy) {
      const scale = policy.gradeScales.find(
        (gs) => summary.averagePercentage >= parseFloat(gs.minPercentage) &&
               summary.averagePercentage <= parseFloat(gs.maxPercentage)
      );
      if (scale) overallGrade = scale.grade;
    }
  }

  const summaryHtml = summary.averagePercentage !== null ? `
    <tr class="summary-row">
      <td class="subject-name"><strong>Overall</strong></td>
      <td class="result-cell" colspan="${Math.max(totalAssessmentCols - 3, 1)}"></td>
      <td class="result-cell"><strong>${summary.averagePercentage.toFixed(schoolSettings?.decimalPrecision || 2)}%</strong></td>
      <td class="result-cell"><strong>${overallGrade || '-'}</strong></td>
      <td class="result-cell"><strong>${summary.gpa !== null ? summary.gpa.toFixed(2) : '-'}</strong></td>
    </tr>
    <tr class="status-row">
      <td colspan="${totalAssessmentCols + 4}" class="status-cell">
        Result: <strong>${summary.resultStatus}</strong>
        ${summary.gpa !== null ? ` &nbsp;|&nbsp; GPA: <strong>${summary.gpa.toFixed(2)}</strong>` : ''}
      </td>
    </tr>
  ` : '';

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
  html = html.replace('{{SUMMARY_ROWS}}', summaryHtml);
  html = html.replace('{{STUDENT_ID}}', student?.studentId || '');
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
