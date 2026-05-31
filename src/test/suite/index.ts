import * as path from 'path';
import Mocha from 'mocha';
import * as fs from 'fs';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        fs.readdir(path.join(testsRoot, 'suite'), (err, files) => {
            if (err) {
                return reject(err);
            }
            
            files.filter(f => f.endsWith('.test.js')).forEach(file => {
                mocha.addFile(path.resolve(testsRoot, 'suite', file));
            });

            try {
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                      } else {
                        resolve();
                      }
                });
            } catch (err) {
                reject(err);
            }
        });
    });
}
