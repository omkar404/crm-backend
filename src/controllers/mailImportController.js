const { importMails } = require("./mailController");

module.exports = {
  importFromExcel: importMails,
  importFromUpload: importMails,
};
