import {H2Adapter} from '../index.es6';
describe('test h2 db', ()=> {

    let options = {
        "path":"/Users/kbarbounakis/Projects/themost/event-management/db/event",
        "user":"SA",
        "password":""
    };

    it('should execute count', (done)=> {
        let adp = new H2Adapter(options);
        adp.open(()=> {
           adp.execute('SELECT COUNT(*) AS "count" FROM "GroupData"', null, (err, res)=> {
              if(err) {
                  return done(err);
              }
              console.log('INFO', 'DATA', res);
              return done();
           });
        });
    });
});