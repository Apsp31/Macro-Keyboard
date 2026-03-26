const HID = require("node-hid");

const VENDOR_ID = 0x1189;
const PRODUCT_ID = 0x8840;
const REPORT_LENGTH = Number(process.env.HID_REPORT_LENGTH || 65);
const MAX_REPORT_ID = Number(process.env.HID_MAX_REPORT_ID || 32);

const target = HID.devices().find(
  (device) =>
    device.vendorId === VENDOR_ID &&
    device.productId === PRODUCT_ID &&
    (device.usagePage === 0xff00 || device.interface === 0)
);

if (!target) {
  console.error("No matching vendor HID interface found.");
  process.exit(1);
}

let device;

try {
  device = new HID.HID(target.path);
} catch (error) {
  console.error(`OPEN ERR: ${error.message || error}`);
  process.exit(2);
}

const results = [];

for (let reportId = 0; reportId <= MAX_REPORT_ID; reportId += 1) {
  try {
    const data = device.getFeatureReport(reportId, REPORT_LENGTH);
    results.push({
      reportId,
      length: data.length,
      data: Array.from(data)
    });
  } catch (error) {
    results.push({
      reportId,
      error: error.message || String(error)
    });
  }
}

try {
  device.close();
} catch {}

console.log(JSON.stringify(results, null, 2));
