
function generateCharacterStrings(characters, maxLength) {
    const result = [];
    const length = characters.length;
    for (let i = 0; i < length; i++) {
        for (let j = 0; j < length; j++) {
            for (let k = 0; k < length; k++) {
                    const str = characters[i] + characters[j] + characters[k];
                    result.push(str);

                    if (maxLength >= 0 && result.length == maxLength) {
                        return result;
                    }
            }
        }
    }
    return [...new Set(result)];
}

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const result = generateCharacterStrings(characters, 2704);

console.info(result.length, JSON.stringify(result)); // Default total Output: 2704
