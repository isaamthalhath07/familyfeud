// Tests each public broker: publish a retained msg with client A, then check client B receives it.
const mqtt = require('mqtt');

const BROKERS = [
  { name: 'emqx', url: 'wss://broker.emqx.io:8084/mqtt' },
  { name: 'hivemq', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { name: 'shiftr', url: 'wss://public.cloud.shiftr.io', username: 'public', password: 'public' },
  { name: 'mosquitto', url: 'wss://test.mosquitto.org:8081' },
];

const TOPIC = 'parivarfeud-test/xk29q/state';

function test(b) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const opts = { connectTimeout: 6000, reconnectPeriod: 0, username: b.username, password: b.password };
    const done = (r) => { try { a.end(true); } catch {} try { c && c.end(true); } catch {} resolve(`${b.name}: ${r}`); };
    const timer = setTimeout(() => done('TIMEOUT'), 12000);
    let c;
    const a = mqtt.connect(b.url, opts);
    a.on('error', (e) => { clearTimeout(timer); done('ERROR ' + e.message); });
    a.on('connect', () => {
      const payload = JSON.stringify({ rev: Date.now() });
      a.publish(TOPIC, payload, { qos: 1, retain: true }, () => {
        c = mqtt.connect(b.url, opts);
        c.on('error', (e) => { clearTimeout(timer); done('ERROR(B) ' + e.message); });
        c.on('connect', () => c.subscribe(TOPIC, { qos: 1 }));
        c.on('message', (_t, msg) => {
          if (msg.toString() === payload) { clearTimeout(timer); done(`OK retained received in ${Date.now() - t0}ms`); }
        });
      });
    });
  });
}

(async () => {
  const results = await Promise.all(BROKERS.map(test));
  console.log(results.join('\n'));
  process.exit(0);
})();
