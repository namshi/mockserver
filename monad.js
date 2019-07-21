function Monad(val) {
    this.__value = val;
    this.map = function map(f) {
        return Monad.of(f(this.__value));
    }
    this.join = function join() {
        return this.__value;
    }
    this.chain = function chain(f) {
        return this.map(f).join();
    }
}
Monad.of = function(val) {
    return new Monad(val);
}


module.exports = Monad;
