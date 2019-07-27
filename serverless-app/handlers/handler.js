// event.body comes in as a JSON string
module.exports.add = async (event) => {
  const {num1, num2} = JSON.parse(event.body)
  return {
    statusCode: 200,
    body: JSON.stringify({
      num1,
      num2,
      result: num1 * num2
    }),
  };
};