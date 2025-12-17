const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Configurar cliente DynamoDB
const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamoDB = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

// Criar ou atualizar usuário
async function createOrUpdateUser(userData) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      userId: userData.userId,
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      googleId: userData.googleId,
      authProvider: userData.authProvider, // 'google' ou 'email'
      password: userData.password || null, // Apenas para login tradicional
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  try {
    await dynamoDB.send(new PutCommand(params));
    return { success: true, user: params.Item };
  } catch (error) {
    console.error('Erro ao criar/atualizar usuário:', error);
    throw error;
  }
}

// Buscar usuário por email
async function getUserByEmail(email) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'email-index', // Precisará criar este índice no DynamoDB
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email,
    },
  };

  try {
    const result = await dynamoDB.send(new QueryCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    throw error;
  }
}

// Buscar usuário por Google ID
async function getUserByGoogleId(googleId) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: 'googleId-index', // Precisará criar este índice no DynamoDB
    KeyConditionExpression: 'googleId = :googleId',
    ExpressionAttributeValues: {
      ':googleId': googleId,
    },
  };

  try {
    const result = await dynamoDB.send(new QueryCommand(params));
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    console.error('Erro ao buscar usuário por Google ID:', error);
    throw error;
  }
}

// Buscar usuário por ID
async function getUserById(userId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId: userId,
    },
  };

  try {
    const result = await dynamoDB.send(new GetCommand(params));
    return result.Item || null;
  } catch (error) {
    console.error('Erro ao buscar usuário por ID:', error);
    throw error;
  }
}

module.exports = {
  createOrUpdateUser,
  getUserByEmail,
  getUserByGoogleId,
  getUserById,
};
