var assert = require('assert');
const {expect} = require('chai');
const Nightmare = require('..');

describe('Array', function () {

    describe('#indexOf()', function () {
        it('should be constructable', function* () {
            var nightmare = Nightmare();
            nightmare.should.be.ok;
            yield nightmare.end();
        });

        it('should provide useful errors for .click', function (done) {
            var nightmare = new Nightmare({
                show: true
            });

            nightmare
                .goto('about:blank')
                .catch(function (error) {
                    error.should.include('a.not-here');
                    done();
                });
        });
    });
});