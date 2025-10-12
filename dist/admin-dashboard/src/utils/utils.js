/**
 * Masks the given name by replacing characters with asterisks, except for the first and last characters of each name part.
 * @param {string} name - The name to be masked.
 * @returns {string} - The masked name.
 */
function maskName(name) {
  const nameParts = name.split(' ');
  return nameParts.map(part => {
    if (part.length <= 2) return part;
    return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
  }).join(' ');
}

module.exports = {
  maskName
};
