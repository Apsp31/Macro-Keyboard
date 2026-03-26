const HID = require("node-hid");

const VENDOR_ID = 0x1189;
const PRODUCT_ID = 0x8840;

const devices = HID.devices()
  .filter((device) => device.vendorId === VENDOR_ID && device.productId === PRODUCT_ID)
  .map((device) => ({
    vendorId: device.vendorId,
    productId: device.productId,
    path: device.path,
    interface: device.interface,
    usagePage: device.usagePage,
    usage: device.usage,
    serialNumber: device.serialNumber,
    manufacturer: device.manufacturer,
    product: device.product,
    release: device.release
  }));

console.log(JSON.stringify(devices, null, 2));
