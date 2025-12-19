const { v4: uuid } = require('uuid');
const { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
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
    color: payload.color || 'red-alert',
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
    color: data.color,
    createdAt: now(),
  };
  await dynamo.send(new PutCommand({ TableName: TABLE, Item: item }));
  return item;
}

async function updateEvent(userId, eventId, payload) {
  const data = normalize(payload);
  const params = {
    TableName: TABLE,
    Key: { userId, eventId },
    UpdateExpression: 'SET #name = :name, classId = :classId, #weight = :weight, #grade = :grade, #date = :date, #time = :time, #color = :color, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'name',
      '#weight': 'weight',
      '#grade': 'grade',
      '#date': 'date',
      '#time': 'time',
      '#color': 'color',
    },
    ExpressionAttributeValues: {
      ':name': data.name,
      ':classId': data.classId,
      ':weight': data.weight,
      ':grade': data.grade,
      ':date': data.date,
      ':time': data.time,
      ':color': data.color,
      ':updatedAt': now(),
    },
    ReturnValues: 'ALL_NEW',
  };
  const res = await dynamo.send(new UpdateCommand(params));
  return res.Attributes;
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

async function deleteEvent(userId, eventId) {
  await dynamo.send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, eventId },
  }));
}

module.exports = {
  createEvent,
  updateEvent,
  listEventsByUser,
  deleteEvent,
};
