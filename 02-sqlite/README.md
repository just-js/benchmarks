# 02. SQLite Bunfight

This is a small benchmark for testing optimal performance of SQLite javascript 
drivers for node.js, bun.js, just-js and deno.

A related article can be read [here](https://just.billywhizz.io/blog/on-javascript-performance-03/).

## Building the benchmark

Please follow instructions in [README.md](../README.md) for instructions on how to build the benchmark docker image before building this one which is derived from it.

```bash
docker build -t benchmark-02-sqlite .
## we run as privileged to avoid seccomp and other interference with 
## native performance
docker run --privileged -it --rm -v $(pwd)/out:/bench/out benchmark-02-sqlite
```

## Running the benchmark

```
just run.js 10 10000000
```

the first argument is the number of times to repeat the test for each program.
the second argument is the number of iterations to perform in the test.
the results will be output into out/results.json.
results can be viewed by browsing out/results.html in a web browser.
