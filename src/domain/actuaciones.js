const { ObjectId } = require('mongodb');

// Una actuación es inmutable una vez creada (RF-07).
async function agregarActuacion(db, datos) {
  const { expedienteId, texto, funcionarioId } = datos;
  const doc = {
    expedienteId: new ObjectId(expedienteId),
    texto,
    funcionarioId: new ObjectId(funcionarioId),
    fecha: new Date(),
  };
  const res = await db.collection('actuaciones').insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

function listarPorExpediente(db, expedienteId) {
  // Orden cronológico estable: desempata por _id cuando coincide la fecha (mismo ms).
  return db.collection('actuaciones')
    .find({ expedienteId: new ObjectId(expedienteId) })
    .sort({ fecha: 1, _id: 1 }).toArray();
}

module.exports = { agregarActuacion, listarPorExpediente };
