module.exports.getSegments = ({ original }) => {
  const hasIndex = /\[[0-9]+\]/g;

  const indexes = (original.match(hasIndex) || []);

  const segments = [
    original.replace(indexes.join(''), ''),
    ...indexes,
  ];
  return segments;
};
