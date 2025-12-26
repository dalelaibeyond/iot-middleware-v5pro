// test/debug-parsers.js
const V5008Parser = require('../src/modules/normalizer/parsers/V5008Parser');
const V6800Parser = require('../src/modules/normalizer/parsers/V6800Parser');
const UnifyNormalizer = require('../src/modules/normalizer/UnifyNormalizer');

const v5 = new V5008Parser();
const v6 = new V6800Parser();
const normalizer = new UnifyNormalizer();

async function runTest() {
    console.log("=== TEST 1: V5008 FLOW ===");
    // Hex for: Heartbeat, ModAddr 1, ModId 3963041727 (EC3737BF)
    const rawHex = Buffer.from("CC01EC3737BF060000000000000000000000000000F200168F", "hex"); 
    const parsedV5 = v5.parse("V5008Upload/2437871205/OpeAck", rawHex);
    console.log("Parsed V5:", JSON.stringify(parsedV5, null, 2));
    
    const normalizedV5 = await normalizer.normalize(parsedV5);
    console.log("Normalized V5:", JSON.stringify(normalizedV5, null, 2));

    console.log("\n=== TEST 2: V6800 FLOW ===");
    const rawJson = JSON.stringify({
        msg_type: "heart_beat_req",
        module_type: "mt_gw",
        module_sn: "2123456789",
        uuid_number: "1534195387",
        data: [{ module_index: 2, module_sn: "3963041727" }]
    });
    
    const parsedV6 = v6.parse("V6800Upload/2123456789/HeartBeat", rawJson);
    console.log("Parsed V6:", JSON.stringify(parsedV6, null, 2));

    const normalizedV6 = await normalizer.normalize(parsedV6);
    console.log("Normalized V6:", JSON.stringify(normalizedV6, null, 2));
}

runTest();