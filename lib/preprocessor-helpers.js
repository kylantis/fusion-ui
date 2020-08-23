module.exports.getSegments = ({ original, zeroIndexes = false }) => {
  const number = /[0-9]+/g;
  const hasIndex = /\[[0-9]+\]/g;

  let indexes = (original.match(hasIndex) || []);
  if (zeroIndexes) {
    indexes = indexes.map(index => index.replace(number, '0'));
  }
  return [
    original.replace(indexes.join(''), ''),
    ...indexes,
  ];
};
