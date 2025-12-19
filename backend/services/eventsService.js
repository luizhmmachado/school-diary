const { v4: uuid } = require('uuid');
const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamo } = require('../config/dbClient');

const TABLE = process.env.DYNAMODB_EVENTS_TABLE || 'school-diary-events';

function now() {
  return new Date().toISOString();
}

function normalize(payload = {}) {
  return {
    name: payload.name || 'Evento',
    weight: payload.weight !== undefined ? Number(payload.weight) : null,
    grade: payload.grade !== undefined && payload.grade !== '' ? Number(payload.grade) : null,
    date: payload.date || '',
    time: payload.time || '',
    classId: payload.classId || '',
  };
}

async function createEvent(userId, payload) {
  const data = normalize(payload);
  const item = {
    userId,
    eventId: uuid(),
    classId: data.classId,
    name: data.name,
    weight: data.weight,
    grade: data.grade,
    date: data.date,
    time: data.time,
    createdAt: now(),
  };
  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function listEventsByUser(userId) {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: {
      ':uid': userId,
    },
  };
  const res = await dynamo.send(new QueryCommand(params));
  return res.Items || [];
}

module.exports = {
  createEvent,
  listEventsByUser,
};
