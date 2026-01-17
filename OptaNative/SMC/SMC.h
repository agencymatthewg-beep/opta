//
//  SMC.h
//  OptaNative
//
//  SMC (System Management Controller) header for IOKit communication.
//  Based on Stats (https://github.com/exelban/stats) implementation.
//

#ifndef SMC_h
#define SMC_h

#include <IOKit/IOKitLib.h>

// SMC key data structure sizes
#define SMC_KEY_DATA_SIZE 32

// SMC selector for IOConnectCallStructMethod
#define SMC_CMD_READ_BYTES  5
#define SMC_CMD_WRITE_BYTES 6
#define SMC_CMD_READ_KEYINFO 9
#define SMC_CMD_READ_PLIMIT 11
#define SMC_CMD_READ_VERS  12
#define SMC_CMD_READ_INDEX 8

// SMC version structure
typedef struct {
    unsigned char major;
    unsigned char minor;
    unsigned char build;
    unsigned char reserved[1];
    unsigned short release;
} SMCKeyData_vers_t;

// SMC power limit data structure
typedef struct {
    uint16_t version;
    uint16_t length;
    uint32_t cpuPLimit;
    uint32_t gpuPLimit;
    uint32_t memPLimit;
} SMCKeyData_pLimitData_t;

// SMC key info structure
typedef struct {
    uint32_t dataSize;
    uint32_t dataType;
    uint8_t  dataAttributes;
} SMCKeyData_keyInfo_t;

// Main SMC communication structure
typedef struct {
    uint32_t key;
    SMCKeyData_vers_t vers;
    SMCKeyData_pLimitData_t pLimitData;
    SMCKeyData_keyInfo_t keyInfo;
    uint8_t result;
    uint8_t status;
    uint8_t data8;
    uint32_t data32;
    unsigned char bytes[SMC_KEY_DATA_SIZE];
} SMCKeyData_t;

// SMC value structure for Swift bridge
typedef struct {
    char key[5];
    uint32_t dataSize;
    uint32_t dataType;
    unsigned char bytes[SMC_KEY_DATA_SIZE];
} SMCVal_t;

// Function declarations for SMC communication
kern_return_t SMCOpen(io_connect_t *conn);
kern_return_t SMCClose(io_connect_t conn);
kern_return_t SMCReadKey(io_connect_t conn, const char *key, SMCVal_t *val);
kern_return_t SMCGetKeyInfo(io_connect_t conn, uint32_t key, SMCKeyData_keyInfo_t *keyInfo);
uint32_t SMCKeyToUInt32(const char *key);

#endif /* SMC_h */
