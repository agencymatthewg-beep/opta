//
//  SMC.c
//  OptaNative
//
//  SMC (System Management Controller) IOKit communication implementation.
//  Based on Stats (https://github.com/exelban/stats) implementation.
//

#include "SMC.h"
#include <string.h>

// Convert 4-character key string to UInt32
uint32_t SMCKeyToUInt32(const char *key) {
    return ((uint32_t)key[0] << 24) |
           ((uint32_t)key[1] << 16) |
           ((uint32_t)key[2] << 8) |
           ((uint32_t)key[3]);
}

// Open connection to AppleSMC service
kern_return_t SMCOpen(io_connect_t *conn) {
    io_service_t service;
    kern_return_t result;

    // Find the AppleSMC service
    service = IOServiceGetMatchingService(kIOMainPortDefault,
                                          IOServiceMatching("AppleSMC"));

    if (service == 0) {
        return kIOReturnNotFound;
    }

    // Open connection to the service
    result = IOServiceOpen(service, mach_task_self(), 0, conn);
    IOObjectRelease(service);

    return result;
}

// Close SMC connection
kern_return_t SMCClose(io_connect_t conn) {
    return IOServiceClose(conn);
}

// Get key info (data size and type)
kern_return_t SMCGetKeyInfo(io_connect_t conn, uint32_t key, SMCKeyData_keyInfo_t *keyInfo) {
    SMCKeyData_t inputData;
    SMCKeyData_t outputData;
    size_t inputSize = sizeof(SMCKeyData_t);
    size_t outputSize = sizeof(SMCKeyData_t);

    memset(&inputData, 0, sizeof(inputData));
    memset(&outputData, 0, sizeof(outputData));

    inputData.key = key;
    inputData.data8 = SMC_CMD_READ_KEYINFO;

    kern_return_t result = IOConnectCallStructMethod(
        conn,
        2, // kSMCHandleYPCEvent
        &inputData,
        inputSize,
        &outputData,
        &outputSize
    );

    if (result == kIOReturnSuccess) {
        keyInfo->dataSize = outputData.keyInfo.dataSize;
        keyInfo->dataType = outputData.keyInfo.dataType;
        keyInfo->dataAttributes = outputData.keyInfo.dataAttributes;
    }

    return result;
}

// Read SMC key value
kern_return_t SMCReadKey(io_connect_t conn, const char *key, SMCVal_t *val) {
    SMCKeyData_t inputData;
    SMCKeyData_t outputData;
    SMCKeyData_keyInfo_t keyInfo;
    size_t inputSize = sizeof(SMCKeyData_t);
    size_t outputSize = sizeof(SMCKeyData_t);
    kern_return_t result;

    memset(&inputData, 0, sizeof(inputData));
    memset(&outputData, 0, sizeof(outputData));
    memset(&keyInfo, 0, sizeof(keyInfo));
    memset(val, 0, sizeof(SMCVal_t));

    // Copy key name
    strncpy(val->key, key, 4);
    val->key[4] = '\0';

    // Convert key to UInt32
    uint32_t keyUInt = SMCKeyToUInt32(key);

    // First, get key info to determine data size and type
    result = SMCGetKeyInfo(conn, keyUInt, &keyInfo);
    if (result != kIOReturnSuccess) {
        return result;
    }

    val->dataSize = keyInfo.dataSize;
    val->dataType = keyInfo.dataType;

    // Now read the actual data
    inputData.key = keyUInt;
    inputData.data8 = SMC_CMD_READ_BYTES;
    inputData.keyInfo.dataSize = keyInfo.dataSize;

    result = IOConnectCallStructMethod(
        conn,
        2, // kSMCHandleYPCEvent
        &inputData,
        inputSize,
        &outputData,
        &outputSize
    );

    if (result == kIOReturnSuccess) {
        memcpy(val->bytes, outputData.bytes, sizeof(val->bytes));
    }

    return result;
}
