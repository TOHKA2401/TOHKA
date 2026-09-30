const FILE_NAME = 'tohka_hub_data.json';

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify(getData()))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    saveData(data);
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getData() {
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    return JSON.parse(files.next().getBlob().getDataAsString());
  }
  return { schedule: {}, vault: [] };
}

function saveData(data) {
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    files.next().setContent(JSON.stringify(data));
  } else {
    DriveApp.createFile(FILE_NAME, JSON.stringify(data), MimeType.PLAIN_TEXT);
  }
}
