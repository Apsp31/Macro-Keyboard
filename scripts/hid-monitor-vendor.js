const HID = require("node-hid");

const VENDOR_ID = 0x1189;
const PRODUCT_ID = 0x8840;
const DURATION_MS = Number(process.env.HID_MONITOR_MS || 30000);

function hex(value) {
  if (value === undefined || value === null) {
    return "unknown";
  }

  return `0x${value.toString(16).toUpperCase()}`;
}

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

console.log("Vendor interface target:");
console.log(
  JSON.stringify(
    {
      path: target.path,
      interface: target.interface,
      usagePage: hex(target.usagePage),
      usage: hex(target.usage),
      product: target.product,
      manufacturer: target.manufacturer
    },
    null,
    2
  )
);

let device;

try {
  device = new HID.HID(target.path);
} catch (error) {
  console.error(`OPEN ERR: ${error.message || error}`);
  process.exit(2);
}

console.log(`Listening for ${DURATION_MS / 1000} seconds...`);
console.log("Suggested actions: OEM startup, Read configuration, switch layers, Download.");

device.on("data", (data) => {
  console.log(`DATA ${new Date().toISOString()} ${JSON.stringify(Array.from(data))}`);
});

device.on("error", (error) => {
  console.log(`ERROR ${new Date().toISOString()} ${error.message || error}`);
});

setTimeout(() => {
  try {
    device.close();
  } catch {}
  process.exit(0);
}, DURATION_MS);
