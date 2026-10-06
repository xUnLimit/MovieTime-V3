import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotNode } from '@/types/bot';
import { MAX_CONTINUE_HOPS, NODE_LIMITS, WAIT_HOURS } from './catalog';
import { defaultDefinition } from './defaults';
import { diffDefinitions } from './diff';
import { addCatchAllOption, addNode, addOption, canAddOption, optionLimitOf, removeOption, setTextAfter, updateNode } from './edit';
import { parseDefinition } from './schema';
import { answerSimulation, startSimulation, stepSimulation } from './simulate';
import { validateDefinition } from './validate';

const withText = (): BotDefinition => addNode(defaultDefinition(), 'text', 'Aviso');
const aviso = (def: BotDefinition): BotNode => def.nodes.find((node) => node.id === 'aviso')!;
const errors = (def: BotDefinition) => validateDefinition(def).filter((issue) => issue.severity === 'error');
const warnings = (def: BotDefinition) => validateDefinition(def).filter((issue) => issue.severity === 'warning');
/** El menú lleva al aviso con un botón, para que el nodo sea alcanzable. */
function reachable(def: BotDefinition): BotDefinition {
  return { ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [...node.options, { id: 'aviso', title: 'Aviso', next: 'aviso' }] } : node)) };
}
function updateNodeOptions(def: BotDefinition, options: BotNode['options']): BotDefinition {
  return { ...def, nodes: def.nodes.map((node) => (node.id === 'aviso' ? { ...node, options } : node)) };
}

describe('setTextAfter', () => {
  it.each([1, 5, 7, 30, 4320])('permite %i minutos y conserva la duración al leer la definición', minutes => {
    const def = reachable(setTextAfter(withText(), 'aviso', 'wait'));
    aviso(def).after = { mode: 'wait', hours: minutes / 60, unit: 'minutes' };
    expect(errors(def)).toEqual([]);
    const parsed = parseDefinition(def);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(aviso(parsed.definition).after).toEqual(aviso(def).after);
  });

  it.each([0, 0.5, 1.5, 4321, Number.POSITIVE_INFINITY])('rechaza %s minutos inválidos', minutes => {
    const def = reachable(setTextAfter(withText(), 'aviso', 'wait'));
    aviso(def).after = { mode: 'wait', hours: minutes / 60, unit: 'minutes' };
    expect(errors(def).some(issue => issue.path === 'nodes[aviso].after')).toBe(true);
  });
  it('un texto nuevo es final y no admite salidas', () => {
    const node = aviso(withText());
    expect(node.after).toBeUndefined();
    expect(optionLimitOf(node)).toBe(0);
    expect(canAddOption(node)).toBe(false);
  });

  it('continuar deja una sola salida válida y volver a terminar quita las salidas', () => {
    const def = setTextAfter(withText(), 'aviso', 'continue');
    expect(aviso(def).after).toEqual({ mode: 'continue' });
    expect(aviso(def).options).toHaveLength(1);
    expect(aviso(def).options[0].next).toBe('menu');
    expect(canAddOption(aviso(def))).toBe(false);
    const ended = setTextAfter(def, 'aviso', 'end');
    expect(aviso(ended).after).toBeUndefined();
    expect(aviso(ended).options).toEqual([]);
  });

  it('esperar empieza con «cualquier otra respuesta» y conserva el destino que ya tenía', () => {
    const def = setTextAfter(setTextAfter(withText(), 'aviso', 'continue'), 'aviso', 'wait');
    expect(aviso(def).after).toEqual({ mode: 'wait', hours: WAIT_HOURS.default });
    expect(aviso(def).options).toEqual([{ id: 'otra_respuesta', title: '', next: 'menu', any: true }]);
  });

  it('solo aplica a textos y no cambia nada si ya está en ese modo', () => {
    const def = withText();
    expect(setTextAfter(def, 'menu', 'wait')).toBe(def);
    expect(setTextAfter(def, 'aviso', 'end')).toBe(def);
    expect(setTextAfter(def, 'no_existe', 'wait')).toBe(def);
    const waiting = setTextAfter(def, 'aviso', 'wait');
    expect(setTextAfter(waiting, 'aviso', 'wait')).toBe(waiting);
  });

  it('cambiar el tipo del nodo descarta lo que esperaba', () => {
    const waiting = setTextAfter(withText(), 'aviso', 'wait');
    expect(aviso(updateNode(waiting, 'aviso', { kind: 'buttons' })).after).toBeUndefined();
  });
});

describe('respuestas de un texto que espera', () => {
  const waiting = () => setTextAfter(withText(), 'aviso', 'wait');

  it('agrega respuestas hasta el tope y una sola «cualquier otra respuesta»', () => {
    let def = waiting();
    expect(optionLimitOf(aviso(def))).toBe(NODE_LIMITS.listRowsMax);
    def = addOption(def, 'aviso');
    expect(aviso(def).options.map((option) => option.title)).toEqual(['', 'Nueva respuesta']);
    expect(addCatchAllOption(def, 'aviso')).toBe(def);
    def = removeOption(def, 'aviso', 'otra_respuesta');
    def = addCatchAllOption(def, 'aviso');
    expect(aviso(def).options.filter((option) => option.any)).toHaveLength(1);
    for (let index = 0; index < NODE_LIMITS.listRowsMax; index += 1) def = addOption(def, 'aviso');
    expect(aviso(def).options).toHaveLength(NODE_LIMITS.listRowsMax);
    expect(canAddOption(aviso(def))).toBe(false);
    expect(addCatchAllOption(removeOption(def, 'aviso', aviso(def).options.find((option) => option.any)!.id), 'aviso')).not.toBe(def);
  });

  it('la «cualquier otra respuesta» solo existe en textos que esperan', () => {
    const def = withText();
    expect(addCatchAllOption(def, 'aviso')).toBe(def);
    expect(addOption(def, 'aviso')).toBe(def);
  });
});

describe('validación de un texto con «después»', () => {
  it('un texto final con salidas sigue siendo un error; con «después» ya no', () => {
    const final = reachable(withText());
    expect(errors(updateNodeOptions(final, [{ id: 'x', title: 'x', next: 'menu' }])).some((issue) => issue.message.includes('no admite opciones'))).toBe(true);
    expect(errors(setTextAfter(reachable(withText()), 'aviso', 'continue'))).toEqual([]);
  });

  it('continuar exige exactamente una salida y no pide título', () => {
    const def = reachable(setTextAfter(withText(), 'aviso', 'continue'));
    expect(errors(def)).toEqual([]);
    expect(errors(updateNodeOptions(def, [])).some((issue) => issue.message.includes('Elige a qué paso continúa'))).toBe(true);
  });

  it('esperar acepta respuestas con palabras y una «cualquier otra», y valida sus límites', () => {
    const base = reachable(setTextAfter(withText(), 'aviso', 'wait'));
    expect(errors(base)).toEqual([]);
    expect(errors(updateNodeOptions(base, [{ id: 'si', title: 'sí, claro', next: 'menu' }, { id: 'otra', title: '', next: 'menu', any: true }]))).toEqual([]);
    expect(errors(updateNodeOptions(base, [{ id: 'a', title: '', next: 'menu', any: true }, { id: 'b', title: '', next: 'menu', any: true }])).some((issue) => issue.message.includes('Solo puede haber una'))).toBe(true);
    expect(errors(updateNodeOptions(base, [])).some((issue) => issue.message.includes('Agrega al menos una respuesta'))).toBe(true);
    expect(errors(updateNodeOptions(base, [{ id: 'a', title: '  ', next: 'menu' }])).some((issue) => issue.message.includes('Escribe las palabras de la respuesta'))).toBe(true);
    expect(errors(updateNodeOptions(base, [{ id: 'a', title: 'x'.repeat(NODE_LIMITS.answerMax + 1), next: 'menu' }])).some((issue) => issue.message.includes('Las palabras de la respuesta superan'))).toBe(true);
    expect(errors(updateNodeOptions(base, [{ id: 'a', title: 'sí', next: 'no_existe' }])).some((issue) => issue.message.includes('no existe'))).toBe(true);
    const many = Array.from({ length: NODE_LIMITS.listRowsMax + 1 }, (_, index) => ({ id: `r${index}`, title: `palabra${index}`, next: 'menu' }));
    expect(errors(updateNodeOptions(base, many)).some((issue) => issue.message.includes('Máximo'))).toBe(true);
  });

  it('el tiempo de espera debe ser un número entero de horas dentro del rango', () => {
    const base = reachable(setTextAfter(withText(), 'aviso', 'wait'));
    for (const hours of [0, WAIT_HOURS.max + 1, 1.5]) {
      const def = { ...base, nodes: base.nodes.map((node) => (node.id === 'aviso' ? { ...node, after: { mode: 'wait' as const, hours } } : node)) };
      expect(errors(def).some((issue) => issue.path === 'nodes[aviso].after')).toBe(true);
    }
  });

  it('«después» en un nodo que no es de texto se ignora con un aviso', () => {
    const base = defaultDefinition();
    const def = { ...base, nodes: base.nodes.map((node) => (node.id === 'menu' ? { ...node, after: { mode: 'continue' as const } } : node)) };
    expect(warnings(def).some((issue) => issue.path === 'nodes[menu].after')).toBe(true);
  });

  it('un texto que espera cuenta como final: un ciclo que pasa por él no es un callejón sin salida', () => {
    const waiting = setTextAfter(withText(), 'aviso', 'wait');
    const loop = updateNodeOptions(waiting, [{ id: 'otra', title: '', next: 'aviso', any: true }]);
    expect(errors(reachable(loop)).some((issue) => issue.message.includes('da vueltas'))).toBe(false);
  });
});

describe('cadenas de textos que continúan solos', () => {
  function chain(length: number, bodies: string[] = []): BotDefinition {
    let def = defaultDefinition();
    for (let index = 0; index < length; index += 1) def = addNode(def, 'text', `Paso ${index + 1}`);
    const ids = def.nodes.slice(-length).map((node) => node.id);
    def = { ...def, nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [...node.options, { id: 'ir', title: 'Ir', next: ids[0] }] } : node)) };
    ids.forEach((id, index) => {
      if (index < ids.length - 1) {
        def = setTextAfter(def, id, 'continue');
        def = { ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, options: [{ id: 'siguiente', title: '', next: ids[index + 1] }] } : node)) };
      }
      if (bodies[index] !== undefined) def = updateNode(def, id, { body: bodies[index] });
    });
    return def;
  }

  it('una cadena corta y de tamaño razonable es válida', () => {
    expect(errors(chain(3))).toEqual([]);
  });

  it('una vuelta de textos que continúan es un error (se enviaría en bucle)', () => {
    const def = chain(2);
    const looped = { ...def, nodes: def.nodes.map((node) => (node.id === 'paso_2' ? { ...node, after: { mode: 'continue' as const }, options: [{ id: 'siguiente', title: '', next: 'paso_1' }] } : node)) };
    expect(errors(looped).some((issue) => issue.message.includes('en bucle'))).toBe(true);
  });

  it('más mensajes seguidos que el tope es un error', () => {
    expect(errors(chain(MAX_CONTINUE_HOPS + 2)).some((issue) => issue.message.includes('No puede haber más de'))).toBe(true);
    expect(errors(chain(MAX_CONTINUE_HOPS + 1)).some((issue) => issue.message.includes('No puede haber más de'))).toBe(false);
  });

  it('el texto junto con el del paso donde termina debe caber en un mensaje', () => {
    const half = 'x'.repeat(Math.floor(NODE_LIMITS.bodyMax / 2) + 10);
    expect(errors(chain(2, [half, half])).some((issue) => issue.message.includes('se cortaría'))).toBe(true);
    expect(errors(chain(2, ['corto', 'también corto'])).some((issue) => issue.message.includes('se cortaría'))).toBe(false);
  });

  it('mensajes separados admiten textos largos, conservan la forma y se simulan en burbujas distintas', () => {
    const half = 'x'.repeat(Math.floor(NODE_LIMITS.bodyMax / 2) + 10);
    const def = chain(2, [half, half]);
    def.nodes.find(node => node.id === 'paso_1')!.after = { mode: 'continue', delivery: 'separate' };
    expect(errors(def)).toEqual([]);
    const parsed = parseDefinition(JSON.parse(JSON.stringify(def)));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.definition.nodes.find(node => node.id === 'paso_1')!.after).toEqual({ mode: 'continue', delivery: 'separate' });
    const started = startSimulation({ ...def, entryNodeId: 'paso_1' });
    expect(started.turns.filter(turn => turn.from === 'bot').map(turn => turn.text)).toEqual([half, half]);
    expect(started.finished).toBe(true);
  });

  it('separar un segmento no permite que el segmento anterior combinado exceda el límite', () => {
    const half = 'x'.repeat(Math.floor(NODE_LIMITS.bodyMax / 2) + 10);
    const def = chain(3, [half, half, 'Final']);
    def.nodes.find(node => node.id === 'paso_2')!.after = { mode: 'continue', delivery: 'separate' };
    expect(errors(def).some(issue => issue.message.includes('se cortarían'))).toBe(true);
  });

  it('avisa si el paso siguiente es una acción que no admite un texto antes, salvo pasar a una persona', () => {
    const base = reachable(setTextAfter(withText(), 'aviso', 'continue'));
    const toLogin = updateNodeOptions(base, [{ id: 'siguiente', title: '', next: 'login' }]);
    expect(warnings(toLogin).some((issue) => issue.message.includes('no admite un texto antes'))).toBe(true);
    const toSupport = updateNodeOptions(base, [{ id: 'siguiente', title: '', next: 'soporte' }]);
    expect(warnings(toSupport).some((issue) => issue.message.includes('no admite un texto antes'))).toBe(false);
  });
});

describe('esquema y diferencias', () => {
  it('acepta «después» y la acción de datos de acceso', () => {
    const def = setTextAfter(withText(), 'aviso', 'wait');
    const withAction = { ...def, nodes: [...def.nodes, { id: 'acceso', name: 'Acceso', kind: 'action' as const, body: '', options: [], action: 'service_access' as const }] };
    const parsed = parseDefinition(JSON.parse(JSON.stringify(withAction)));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.definition.nodes.find((node) => node.id === 'aviso')?.after).toEqual({ mode: 'wait', hours: WAIT_HOURS.default });
      expect(parsed.definition.nodes.find((node) => node.id === 'acceso')?.action).toBe('service_access');
    }
  });

  it('rechaza un «después» mal formado', () => {
    const def = JSON.parse(JSON.stringify(withText()));
    def.nodes[def.nodes.length - 1].after = { mode: 'wait' };
    expect(parseDefinition(def).success).toBe(false);
    def.nodes[def.nodes.length - 1].after = { mode: 'otro' };
    expect(parseDefinition(def).success).toBe(false);
    def.nodes[def.nodes.length - 1].after = { mode: 'continue', delivery: 'unknown' };
    expect(parseDefinition(def).success).toBe(false);
  });

  it('una versión publicada sin los mensajes de datos de acceso se completa con los textos por defecto', () => {
    const stored = JSON.parse(JSON.stringify(defaultDefinition()));
    for (const key of ['access_none', 'access_picker_body', 'access_picker_button', 'access_code_notice', 'access_unavailable']) delete stored.messages[key];
    const parsed = parseDefinition(stored);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.definition.messages.access_none).toBe(defaultDefinition().messages.access_none);
      expect(errors(parsed.definition)).toEqual([]);
    }
  });

  it('describe el cambio de lo que pasa después del texto', () => {
    const before = withText();
    expect(diffDefinitions(before, setTextAfter(before, 'aviso', 'wait')).some((change) => change.includes('qué pasa después del texto'))).toBe(true);
    expect(diffDefinitions(before, before)).toEqual([]);
  });
});

describe('simulador con textos que continúan o esperan', () => {
  function journey(): BotDefinition {
    let def = addNode(defaultDefinition(), 'text', 'Aviso');
    def = updateNode(def, 'aviso', { body: 'Antes de seguir, ten tu cuenta a mano.' });
    def = setTextAfter(def, 'aviso', 'continue');
    return { ...def, nodes: def.nodes.map((node) => {
      if (node.id === 'aviso') return { ...node, options: [{ id: 'siguiente', title: '', next: 'netflix' }] };
      if (node.id === 'menu') return { ...node, options: [{ id: 'codigo', title: 'Código de Netflix', next: 'aviso' }, ...node.options.slice(1)] };
      return node;
    }) };
  }

  it('un texto que continúa viaja delante del paso siguiente, en el mismo mensaje', () => {
    const def = journey();
    const state = stepSimulation(def, startSimulation(def), 'codigo');
    const last = state.turns[state.turns.length - 1];
    expect(last.text.startsWith('Antes de seguir, ten tu cuenta a mano.')).toBe(true);
    expect(last.text).toContain('¿Qué código necesitas?');
    expect(last.buttons).toHaveLength(2);
    expect(state.finished).toBe(false);
  });

  it('una cadena cortada o sin destino envía el texto solo y avisa', () => {
    const def = journey();
    const broken = { ...def, nodes: def.nodes.map((node) => (node.id === 'aviso' ? { ...node, options: [{ id: 'siguiente', title: '', next: 'no_existe' }] } : node)) };
    const state = stepSimulation(broken, startSimulation(broken), 'codigo');
    expect(state.finished).toBe(true);
    expect(state.turns[state.turns.length - 1].text).toContain('no tiene un paso siguiente válido');
  });

  function waiting(options: [string, string][]): BotDefinition {
    let def = setTextAfter(addNode(defaultDefinition(), 'text', 'Pregunta'), 'pregunta', 'wait');
    def = updateNode(def, 'pregunta', { body: '¿Quieres hablar con una persona?' });
    return { ...def, nodes: def.nodes.map((node) => {
      if (node.id === 'pregunta') return { ...node, options: options.map(([title, next], index) => ({ id: `r${index}`, title, next, ...(title === '' ? { any: true } : {}) })) };
      if (node.id === 'menu') return { ...node, options: [{ id: 'codigo', title: 'Preguntar', next: 'pregunta' }, ...node.options.slice(1)] };
      return node;
    }) };
  }

  it('un texto que espera deja la simulación esperando lo que escriba el cliente', () => {
    const def = waiting([['sí', 'soporte']]);
    const asked = stepSimulation(def, startSimulation(def), 'codigo');
    expect(asked.finished).toBe(false);
    expect(asked.awaitingNodeId).toBe('pregunta');
    expect(asked.turns[asked.turns.length - 1].text).toBe('¿Quieres hablar con una persona?');
  });

  it('la respuesta que coincide lleva al paso elegido y la que no coincide termina avisando', () => {
    const def = waiting([['sí', 'soporte']]);
    const asked = stepSimulation(def, startSimulation(def), 'codigo');
    const yes = answerSimulation(def, asked, 'Sí, por favor');
    expect(yes.turns[yes.turns.length - 2]).toMatchObject({ from: 'customer', text: 'Sí, por favor' });
    expect(yes.turns[yes.turns.length - 1].text).toBe(def.messages.handoff_ack);
    expect(yes.finished).toBe(true);
    const no = answerSimulation(def, asked, 'tal vez');
    expect(no.finished).toBe(true);
    expect(no.turns[no.turns.length - 1].text).toContain('no contesta');
  });

  it('«cualquier otra respuesta» recibe lo que no coincide, y una respuesta vacía no hace nada', () => {
    const def = waiting([['sí', 'soporte'], ['', 'menu']]);
    const asked = stepSimulation(def, startSimulation(def), 'codigo');
    const other = answerSimulation(def, asked, 'quizá mañana');
    expect(other.turns[other.turns.length - 1].buttons).toBeDefined();
    expect(answerSimulation(def, asked, '   ')).toBe(asked);
    const start = startSimulation(def);
    expect(answerSimulation(def, start, 'hola')).toBe(start);
  });

  it('la acción de datos de acceso explica qué recibe el cliente', () => {
    let def = addNode(defaultDefinition(), 'action', 'Acceso');
    def = updateNode(def, 'acceso', { action: 'service_access' });
    def = { ...def, entryNodeId: 'menu', nodes: def.nodes.map((node) => (node.id === 'menu' ? { ...node, options: [{ id: 'datos', title: 'Mis datos', next: 'acceso' }] } : node)) };
    const state = stepSimulation(def, startSimulation(def), 'datos');
    expect(state.turns[state.turns.length - 1].text).toContain('Notificación de Suscripción');
    expect(state.finished).toBe(true);
  });
});
