const SHEET_NAME = 'Submissions';
const FOLDER_NAME = 'AIN Scavenger Hunt 2026 Photos';

const HEADERS = [
  'id',
  'teamId',
  'teamName',
  'itemId',
  'status',
  'awardedBase',
  'awardedBonus',
  'extraPersonBonus',
  'extraPeople',
  'note',
  'adminNote',
  'submittedAt',
  'updatedAt',
  'photoUrl',
  'photoFileId'
];

function doGet(e) {
  const action = String(e.parameter.action || 'list');
  if (action !== 'list') return jsonOutput({ ok: false, error: 'Unsupported action' }, e);
  return jsonOutput({ ok: true, submissions: listSubmissions_() }, e);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    if (payload.type === 'submission') {
      const saved = saveSubmission_(payload.submission);
      return jsonOutput({ ok: true, submission: saved }, {});
    }
    if (payload.type === 'score_update') {
      const saved = updateScore_(payload);
      return jsonOutput({ ok: true, submission: saved }, {});
    }
    return jsonOutput({ ok: false, error: 'Unsupported type' }, {});
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message }, {});
  }
}

function jsonOutput(data, e) {
  const callback = e && e.parameter && e.parameter.callback;
  const body = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${body});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow.join('') === '') sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  return sheet;
}

function folder_() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
}

function listSubmissions_() {
  const sheet = sheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return rows.filter(row => row[0]).map(rowToSubmission_);
}

function rowToSubmission_(row) {
  const item = {};
  HEADERS.forEach((header, index) => item[header] = row[index]);
  item.itemId = Number(item.itemId || 0);
  item.awardedBase = Number(item.awardedBase || 0);
  item.awardedBonus = Number(item.awardedBonus || 0);
  item.extraPersonBonus = Number(item.extraPersonBonus || 0);
  item.extraPeople = Number(item.extraPeople || 0);
  item.photo = item.photoUrl;
  return item;
}

function findRow_(id) {
  const sheet = sheet_();
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, 1, last - 1, 1).getValues().flat();
  const index = ids.findIndex(value => String(value) === String(id));
  return index < 0 ? -1 : index + 2;
}

function saveSubmission_(submission) {
  if (!submission || !submission.id) throw new Error('Missing submission id');
  const existingRow = findRow_(submission.id);
  const photo = savePhoto_(submission);
  const row = [
    submission.id,
    submission.teamId || '',
    submission.teamName || '',
    Number(submission.itemId || 0),
    submission.status || 'pending',
    Number(submission.awardedBase || 0),
    Number(submission.awardedBonus || 0),
    Number(submission.extraPersonBonus || 0),
    Number(submission.extraPeople || 0),
    submission.note || '',
    submission.adminNote || '',
    submission.submittedAt || new Date().toISOString(),
    new Date().toISOString(),
    photo.url,
    photo.id
  ];
  const sheet = sheet_();
  if (existingRow > 0) sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return rowToSubmission_(row);
}

function savePhoto_(submission) {
  if (submission.photoUrl && submission.photoFileId) return { url: submission.photoUrl, id: submission.photoFileId };
  const dataUrl = String(submission.photo || '');
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return { url: dataUrl, id: '' };
  const ext = match[1].split('/')[1].replace('jpeg', 'jpg');
  const bytes = Utilities.base64Decode(match[2]);
  const name = `${submission.teamName || 'team'}-${submission.itemId || 'item'}-${submission.id}.${ext}`.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  const blob = Utilities.newBlob(bytes, match[1], name);
  const file = folder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    id: file.getId(),
    url: `https://drive.google.com/uc?export=view&id=${file.getId()}`
  };
}

function updateScore_(payload) {
  if (!payload.submissionId) throw new Error('Missing submission id');
  const rowNumber = findRow_(payload.submissionId);
  if (rowNumber < 0) throw new Error('Submission not found');
  const sheet = sheet_();
  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  const current = rowToSubmission_(row);
  current.status = payload.status || current.status || 'pending';
  current.awardedBase = Number(payload.awardedBase || 0);
  current.awardedBonus = Number(payload.awardedBonus || 0);
  current.extraPersonBonus = Number(payload.extraPersonBonus || 0);
  current.adminNote = payload.adminNote || '';
  current.updatedAt = new Date().toISOString();
  const next = HEADERS.map(header => current[header] || '');
  sheet.getRange(rowNumber, 1, 1, next.length).setValues([next]);
  return rowToSubmission_(next);
}
