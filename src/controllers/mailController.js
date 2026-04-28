const mongoose = require("mongoose");

// Safe model loading — prevents "model is not a function" error
const Mail = mongoose.models.Mail || require("../models/Mail");

// Helper: Convert DD-MM-YYYY to Date range
const parseDateDMY = (dateStr) => {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('-');
  return new Date(year, month - 1, day);
};

// GET /api/mail
// const getAllMails = async (req, res) => {
//   try {
//     let {
//       page = 1, limit = 20, status, search, priority, tag, column,
//       sendEmailId, templateType, templateSubject, emailDate,
//       ipAddress, webTabAndType, emailVerified, emailSentType,
//     } = req.query;

//     page = parseInt(page);
//     limit = parseInt(limit);

//     const filter = {};
//     if (status) filter.status = status;
//     if (priority) filter.priority = priority;
//     if (tag) filter.tags = tag;

//     // Map frontend filters to actual database field names
//     if (sendEmailId) filter["Email Id"] = { $regex: `^${sendEmailId}$`, $options: "i" };
//     if (templateType) filter["Template"] = { $regex: `^${templateType}$`, $options: "i" };
//     if (templateSubject) filter["Subject"] = { $regex: `^${templateSubject}$`, $options: "i" };
//     if (ipAddress) filter["IP Address"] = { $regex: `^${ipAddress}$`, $options: "i" };
//     if (webTabAndType) filter["Web"] = { $regex: `^${webTabAndType}$`, $options: "i" };
//     if (emailVerified) filter["email verified"] = { $regex: `^${emailVerified}$`, $options: "i" };
//     if (emailSentType) filter["Email sent"] = { $regex: `^${emailSentType}$`, $options: "i" };

//     // Date filter: use createdAt with DD-MM-YYYY format
// if (emailDate) {
//   const start = parseDateDMY(emailDate);
//   if (start) {
//     const end = new Date(start);
//     end.setDate(end.getDate() + 1);
//     filter.createdAt = { $gte: start, $lt: end };
//   }
// }

//     // Text search across multiple fields
//     if (search && search.trim()) {
//       const regex = { $regex: search.trim(), $options: "i" };
//       if (column) {
//         filter[column] = regex;
//       } else {
//         filter["$or"] = [
//           { name: regex },
//           { "Email Id": regex },
//           { email: regex },
//           { city: regex },
//           { state: regex },
//           { address: regex },
//           { leadStatus: regex },
//           { leadType: regex },
//           { leadSource: regex },
//           { RCMCPanel: regex },
//           { notes: regex },
//           { Template: regex },
//           { Subject: regex },
//         ];
//       }
//     }

//     const total = await Mail.countDocuments(filter);
//     const mails = await Mail.find(filter)
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit);

//     res.json({
//       success: true, total, page, limit,
//       totalPages: Math.ceil(total / limit),
//       data: mails,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };
const getAllMails = async (req, res) => {
  try {
    let {
      page = 1, limit = 20, status, search, priority, tag, column,
      sendEmailId, templateType, templateSubject, emailDate,
      ipAddress, webTabAndType, emailVerified, emailSentType,
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (tag) filter.tags = tag;

// Only add filter if value exists and is not empty
if (sendEmailId && sendEmailId.trim()) filter["Email Id"] = { $regex: sendEmailId.trim(), $options: "i" };
if (templateType && templateType.trim()) filter["Template"] = { $regex: templateType.trim(), $options: "i" };
if (templateSubject && templateSubject.trim()) filter["Subject"] = { $regex: templateSubject.trim(), $options: "i" };
if (ipAddress && ipAddress.trim()) filter["IP Address"] = { $regex: ipAddress.trim(), $options: "i" };
if (webTabAndType && webTabAndType.trim()) filter["Web"] = { $regex: webTabAndType.trim(), $options: "i" };
if (emailVerified && emailVerified.trim()) filter["email verified"] = { $regex: emailVerified.trim(), $options: "i" };
if (emailSentType && emailSentType.trim()) filter["Email sent"] = { $regex: emailSentType.trim(), $options: "i" };

// Date filter – ensure value is valid
if (emailDate && emailDate.trim()) {
  const [day, month, year] = emailDate.split('-');
  if (day && month && year) {
    const start = new Date(parseInt(year), parseInt(month)-1, parseInt(day));
    if (!isNaN(start.getTime())) {
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filter.createdAt = { $gte: start, $lt: end };
    }
  }
}

    // Text search across multiple fields
    if (search && search.trim()) {
      const regex = { $regex: search.trim(), $options: "i" };
      if (column) {
        filter[column] = regex;
      } else {
        filter["$or"] = [
          { name: regex },
          { "Email Id": regex },
          { email: regex },
          { city: regex },
          { state: regex },
          { address: regex },
          { leadStatus: regex },
          { leadType: regex },
          { leadSource: regex },
          { RCMCPanel: regex },
          { notes: regex },
          { Template: regex },
          { Subject: regex },
        ];
      }
    }

    const total = await Mail.countDocuments(filter);
    const mails = await Mail.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true, total, page, limit,
      totalPages: Math.ceil(total / limit),
      data: mails,
    });
  } catch (err) {
    console.error("getAllMails error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/mail/filter-options
const getFilterOptions = async (req, res) => {
  try {
    const [
      sendEmailId,
      templateType,
      templateSubject,
      emailDate,
      ipAddress,
      webTabAndType,
      emailVerified,
      emailSentType,
      status,
    ] = await Promise.all([
      Mail.distinct("Email Id"),
      Mail.distinct("Template"),
      Mail.distinct("Subject"),
      Mail.distinct("Date"),
      Mail.distinct("IP Address"),
      Mail.distinct("Web"),
      Mail.distinct("email verified"),
      Mail.distinct("Email sent"),
      Mail.distinct("Status"),
    ]);

    // Convert Excel serial to "d-MMM-yy" (e.g., 9-Feb-26)
const excelDateToCustomFormat = (serial) => {
  const utcDays = serial - 25569;
  const date = new Date(utcDays * 86400 * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
};

    let emailDates = emailDate
      .filter(d => d && typeof d === 'number')
      .sort((a, b) => a - b)   // sort by original serial number
      .map(d => excelDateToCustomFormat(d))
      .filter((v, i, a) => a.indexOf(v) === i);

if (!emailDates.length) {
  const dateDocs = await Mail.aggregate([
    { $match: { createdAt: { $exists: true } } },
    { $group: { _id: { $dateToString: { format: "%d-%b-%y", date: "$createdAt" } } } },
    { $sort: { _id: 1 } }
  ]);
  emailDates = dateDocs.map(d => d._id);

  console.log("Email dates after processing:", emailDates);
}

    // Normalize statuses
    let statusList = status.filter(v => v).map(v => v.toLowerCase());
    const requiredStatuses = ["draft", "sent", "enquiry", "reached", "bounced", "stop", "not contacted", "contacted"];
    requiredStatuses.forEach(s => { if (!statusList.includes(s)) statusList.push(s); });
    statusList.sort();

    // Normalize emailSentType to Yes/No
    let sentTypeList = emailSentType
      .map(v => v?.toLowerCase() === 'yes' ? 'Yes' : (v?.toLowerCase() === 'no' ? 'No' : null))
      .filter(v => v)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (!sentTypeList.length) sentTypeList = ["Yes", "No"];

    // Email verified defaults
    let verifiedList = emailVerified.filter(v => v);
    if (!verifiedList.length) verifiedList = ["Yes", "No"];

    res.json({
      sendEmailId: sendEmailId.filter(v => v),
      templateType: templateType.filter(v => v),
      templateSubject: templateSubject.map(v => String(v)).filter(v => v),
      emailDate: emailDates,
      ipAddress: ipAddress.filter(v => v),
      webTabAndType: webTabAndType.filter(v => v),
      emailVerified: verifiedList,
      emailSentType: sentTypeList,
      status: statusList,
    });
  } catch (err) {
    console.error("Filter options error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/mail/:id
const getMailById = async (req, res) => {
  try {
    const mail = await Mail.findById(req.params.id);
    if (!mail) return res.status(404).json({ success: false, message: "Mail not found" });
    if (!mail.isRead) { mail.isRead = true; await mail.save(); }
    res.json({ success: true, data: mail });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/mail
const createMail = async (req, res) => {
  try {
    const mail = new Mail({
      ...req.body,
      sentAt: req.body.status === "sent" ? new Date() : null,
      createdBy: req.user?._id || null,
    });
    await mail.save();
    res.status(201).json({ success: true, data: mail });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// PUT /api/mail/:id
const updateMail = async (req, res) => {
  try {
    const mail = await Mail.findById(req.params.id);
    if (!mail) return res.status(404).json({ success: false, message: "Mail not found" });
    const updates = req.body;
    if (updates.status === "sent") updates.sentAt = new Date();
    Object.assign(mail, updates);
    await mail.save();
    res.json({ success: true, data: mail });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/mail/:id
const deleteMail = async (req, res) => {
  try {
    const mail = await Mail.findByIdAndDelete(req.params.id);
    if (!mail) return res.status(404).json({ success: false, message: "Mail not found" });
    res.json({ success: true, message: "Mail deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/mail/:id/send
const sendMail = async (req, res) => {
  try {
    const mail = await Mail.findById(req.params.id);
    if (!mail) return res.status(404).json({ success: false, message: "Mail not found" });
    if (mail.status === "sent") return res.status(400).json({ success: false, message: "Mail already sent" });
    mail.status = "sent";
    mail.sentAt = new Date();
    await mail.save();
    res.json({ success: true, message: "Mail sent successfully", data: mail });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllMails,
  getFilterOptions,
  getMailById,
  createMail,
  updateMail,
  deleteMail,
  sendMail,
};