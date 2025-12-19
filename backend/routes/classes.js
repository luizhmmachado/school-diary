const express = require('express');
const router = express.Router();
const { listClasses, createClass, updateClass, deleteClass } = require('../services/classesService');

function requireUser(req, res, next) {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'x-user-id header é obrigatório' });
  req.userId = userId;
  next();
}

router.get('/', requireUser, async (req, res) => {
  try {
    const items = await listClasses(req.userId);
    res.json(items);
  } catch (err) {
    console.error('Erro ao listar aulas', err);
    res.status(500).json({ error: 'Erro ao listar aulas' });
  }
});

router.post('/', requireUser, async (req, res) => {
  try {
    const item = await createClass(req.userId, req.body || {});
    res.status(201).json(item);
  } catch (err) {
    console.error('Erro ao criar aula', err);
    res.status(500).json({ error: 'Erro ao criar aula' });
  }
});

router.put('/:classId', requireUser, async (req, res) => {
  try {
    const updated = await updateClass(req.userId, req.params.classId, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error('Erro ao atualizar aula', err);
    res.status(500).json({ error: 'Erro ao atualizar aula' });
  }
});

router.delete('/:classId', requireUser, async (req, res) => {
  try {
    await deleteClass(req.userId, req.params.classId);
    res.status(204).send();
  } catch (err) {
    console.error('Erro ao remover aula', err);
    res.status(500).json({ error: 'Erro ao remover aula' });
  }
});

module.exports = router;
