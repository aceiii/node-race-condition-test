import { Mutex } from 'async-mutex';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface IRunner {
  runner: () => Promise<void>;
  sleepFor?: number;
}

interface IRunnerPromise {
  promise: Promise<void>;
  index: number;
}

interface IRace {
  run(): Promise<void>;
  addRunner(runner: () => Promise<void>, ms?: number): void;
  lock(index: number): Promise<() => void>;
}

class Race implements IRace {
  private readonly runners: Array<IRunner> = [];
  private readonly promises: Array<IRunnerPromise> = [];

  async run() {
    await Promise.all(this.runners.map(this.startRunner));
    console.log(`Final promises length: ${this.promises.length}`);
  }

  addRunner = (runner: () => Promise<void>, ms?: number) => {
    this.runners.push({
      runner,
      sleepFor: ms,
    });
  }

  startRunner = ({ runner, sleepFor }: IRunner, index: number) => {
    console.log(`Starting runner:${index}...`);

    const promise = runner();
    this.promises.push({
      promise,
      index,
    });

    return promise.then(async () => {
      const release = await this.lock(index);
      const promiseIndex = this.promises.findIndex((value) => value.promise === promise);
      await sleep(sleepFor ?? 0);
      if (promiseIndex >= 0) {
        console.log(`Removing promise at index:${promiseIndex}, for runner:${index}...`);
        this.logPromises('Promises before:');
        this.promises.splice(promiseIndex, 1);
        this.logPromises('Promises after:');
      }
      release();
    });
  }

  logPromises = (prefix?: string) => {
    console.log(prefix ?? '', this.promises.map(({ index }) => index).toString());
  }

  async lock(index: number) {
    return () => {};
  };
}


class SafeRace extends Race {
  private readonly mutex: Mutex = new Mutex();

  async lock(index: number) {
    const release = await this.mutex.acquire();
    console.log(`Acquired lock for runner:${index}...`);
    return () => {
      console.log(`Releasing lock for runner:${index}...`);
      release();
    };
  }
}


async function main() {
  const race = new Race();

  race.addRunner(async () => {
    console.log('Running first runner...');
    await sleep(1000);
  }, 500);

  race.addRunner(async () => {
    console.log('Running second runner...');
    await sleep(1000);
  });

  race.addRunner(async () => {
    console.log('Running third runner...');
    await sleep(1000);
  }, 100);

  await race.run();
}

async function main2() {
  function createRunner(race: Race, ms: number) {
    race.addRunner(async () => {
      await sleep(1000);
    }, ms);
  }

  const race = new SafeRace();
  //const race = new Race();

  for (let i = 0; i < 10; i += 1) {
    const randomSleep = Math.floor(Math.random() * 10) * 100;
    createRunner(race, randomSleep);
  }

  await race.run();
}


main2();

