const logger = require('../utils/logger');

// Small in-process queue so LLM calls never block the /monitor response.
// Ids added within `delayMs` of each other are grouped, then sent to the
// worker in chunks of `batchSize`, with at most `concurrency` chunks running.
class AlertQueue {
  constructor(worker, { batchSize = 10, concurrency = 2, delayMs = 100 } = {}) {
    this.worker = worker;
    this.batchSize = batchSize;
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    this.pending = new Set();
    this.running = 0;
    this.timer = null;
    this.waiting = [];
  }

  add(ids) {
    ids.forEach((id) => this.pending.add(String(id)));
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pump();
      }, this.delayMs);
    }
  }

  pump() {
    while (this.running < this.concurrency && this.pending.size) {
      const chunk = [...this.pending].slice(0, this.batchSize);
      chunk.forEach((id) => this.pending.delete(id));
      this.running++;

      Promise.resolve()
        .then(() => this.worker(chunk))
        .catch((err) => logger.error(`AI alert generation failed, template text kept: ${err.message}`))
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
    this.checkIdle();
  }

  isIdle() {
    return !this.running && !this.pending.size && !this.timer;
  }

  checkIdle() {
    if (!this.isIdle()) return;
    this.waiting.splice(0).forEach((resolve) => resolve());
  }

  // resolves once everything queued so far has been processed
  onIdle() {
    if (this.isIdle()) return Promise.resolve();
    return new Promise((resolve) => this.waiting.push(resolve));
  }
}

module.exports = AlertQueue;
