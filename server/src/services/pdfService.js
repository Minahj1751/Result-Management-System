const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { ZipArchive } = require('archiver');

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatReportDate = (dateFormat) => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  switch (dateFormat) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    case 'DD-MM-YYYY': return `${dd}-${mm}-${yyyy}`;
    case 'DD MMM YYYY': return `${dd} ${MONTHS[d.getMonth()]} ${String(yyyy).slice(-2)}`;
    case 'DD/MM/YYYY':
    default: return `${dd}/${mm}/${yyyy}`;
  }
};

const formatAssessmentDate = (date, dateFormat) => {
  if (!date) return '';

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  switch (dateFormat) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    case 'DD-MM-YYYY': return `${dd}-${mm}-${yyyy}`;
    case 'DD MMM YYYY': return `${dd} ${MONTHS[d.getUTCMonth()]} ${String(yyyy).slice(-2)}`;
    case 'DD/MM/YYYY':
    default: return `${dd}/${mm}/${yyyy}`;
  }
};

// 7.00 -> 7, 9.50 -> 9.5, 19.25 -> 19.25
const formatMark = (value, precision = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const fixed = n.toFixed(precision);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
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
    semester,
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

  const workingDaysText = attendance?.totalWorkingDays != null
    ? String(attendance.totalWorkingDays)
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
        let markDisplay = 'N/A';
        let markClass = '';
        let assessmentDate = '';
        const categoryResults = jsonData.categoryResults || {};
        // Match by category code key first, then by category name fallback
        const category = Object.values(categoryResults).find(
          (c) => c.categoryName === cat.name || c.categoryCode === cat.code
        );
        if (category) {
          const assessment = category.assessments.find((a) => a.name === assessmentName);
          if (assessment) {
            assessmentDate = formatAssessmentDate(assessment.date, schoolSettings?.dateFormat);
            if (assessment.status === 'ABSENT') {
              markDisplay = 'A';
              markClass = 'mark-absent';
            } else if (assessment.status === 'EXEMPTED') {
              markDisplay = 'E';
              markClass = 'mark-exempt';
            } else if (assessment.status === 'NOT_APPLICABLE') {
              markDisplay = 'N/A';
            } else if (assessment.marksObtained !== null && assessment.marksObtained !== undefined) {
              markDisplay = formatMark(assessment.marksObtained, schoolSettings?.decimalPrecision ?? 2);
            }
          }
        }
        marksCells += `<td><span class="mark-value ${markClass}">${markDisplay}</span>${assessmentDate ? `<span class="date-row">${assessmentDate}</span>` : ''}</td>`;
      });
    });

    const pctDisplay = snapshot.percentage !== null && snapshot.percentage !== undefined
      ? `${Number(snapshot.percentage).toFixed(schoolSettings?.decimalPrecision || 2)}%`
      : 'N/A';
    const gpDisplay = snapshot.gradePoint !== null && snapshot.gradePoint !== undefined
      ? Number(snapshot.gradePoint).toFixed(2)
      : '-';

    return `
      <tr>
        <td class="subject-name">${snapshot.subject.name}</td>
        ${marksCells}
        <!-- Score % / Grade / GPA columns hidden from PDF
        <td class="result-cell">${pctDisplay}</td>
        <td class="result-cell">${snapshot.grade || '-'}</td>
        <td class="result-cell">${gpDisplay}</td>
        -->
      </tr>
    `;
  }).join('');

  const summaryHtml = '';

  const logoPath = path.join(__dirname, '../templates/marksheet/logo.jpg');
  const logoDataUri = `data:image/jpeg;base64,${(await fs.readFile(logoPath)).toString('base64')}`;

  let html = await fs.readFile(
    path.join(__dirname, '../templates/marksheet/template.html'),
    'utf-8'
  );

  // Replace placeholders
  html = html.replaceAll('{{LOGO_SRC}}', logoDataUri);
  html = html.replace('{{SCHOOL_NAME}}', schoolSettings?.schoolName || 'The New School Dhaka');
  html = html.replace('{{SESSION_LABEL}}', schoolSettings?.sessionLabel || 'Academic Session');
  html = html.replace('{{ACADEMIC_SESSION}}', enrollment?.academicSession?.name || '');
  html = html.replace('{{SEMESTER_LABEL}}', schoolSettings?.semesterLabel || 'Semester');
  html = html.replace('{{SEMESTER}}', semester?.name || enrollment?.semester?.name || '');
  html = html.replace('{{STUDENT_NAME}}', student?.fullName || '');
  html = html.replace('{{CLASS}}', enrollment?.schoolClass?.name || '');
  html = html.replace('{{SECTION}}', enrollment?.section?.name || '');
  html = html.replace('{{ROLL_NUMBER}}', enrollment?.rollNumber || '');
  html = html.replace('{{WORKING_DAYS}}', workingDaysText);
  html = html.replace('{{ATTENDANCE}}', attendanceText);
  html = html.replace('{{ATTENDANCE_PERCENTAGE}}', attendancePercentage);
  html = html.replace('{{REPORT_DATE}}', formatReportDate(schoolSettings?.dateFormat));
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
  const archive = new ZipArchive({ zlib: { level: 9 } });

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
