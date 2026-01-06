exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: [],
      message: 'Stop pour aujourd\'hui'
    })
  };
};