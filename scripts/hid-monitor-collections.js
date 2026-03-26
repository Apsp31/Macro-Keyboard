const HID = require("node-hid");

const VENDOR_ID = 0x1189;
const PRODUCT_ID = 0x8840;
const DURATION_MS = Number(process.env.HID_MONITOR_MS || 30000);

const targets = HID.devices().filter(
  (device) =>
    device.vendorId === VENDOR_ID &&
    device.productId === PRODUCT_ID &&
    (
      (device.usagePage === 1 && device.usage === 2) ||
      (device.usagePage === 12 && device.usage === 1)
    )
);

if (!targets.length) {
  console.error("No mouse/media collections found.");
  process.exit(1);
}

console.log("Collection targets:");
console.log(
  JSON.stringify(
    targets.map((target) => ({
      path: target.path,
      interface: target.interface,
      usagePage: target.usagePage,
      usage: target.usage,
      product: target.product
    })),
    null,
    2
  )
);

const opened = [];

for (const target of targets) {
  try {
    const device = new HID.HID(target.path);
    opened.push({ target, device });

    console.log(`LISTEN ${target.path}`);

    device.on("data", (data) => {
      console.log(`DATA ${new Date().toISOString()} ${target.path} ${JSON.stringify(Array.from(data))}`);
    });

    device.on("error", (error) => {
      console.log(`ERROR ${new Date().toISOString()} ${target.path} ${error.message || error}`);
    });
  } catch (error) {
    console.log(`OPEN ERR ${target.path} ${error.message || error}`);
  }
}

console.log(`Listening for ${DURATION_MS / 1000} seconds...`);
console.log("Suggested actions: rotate both wheels, click both wheels, press layer switch.");

setTimeout(() => {
  for (const entry of opened) {
    try {
      entry.device.close();
    } catch {}
  }
  process.exit(0);
}, DURATION_MS);
