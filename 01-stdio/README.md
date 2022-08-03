# goals

The goal of this demo is to establish the overhead of making syscalls in [just(js)](https://github.com/just-js) runtime for Javascript. We will write a simple console application which counts the number of bytes piped to it over stdin. The application will call the read syscall repeatedly in 64k chunks, which seems to be the optimal setting.

We will implement the demo in C, in Javascript on just(js) using both sync and async interfaces. We will also write a comparison application on node.js to establish if there is any extra overhead on that platform.

If you want to skip all the detail below you can go straight to the results and assertions [here]().

# prerequisites

See [README.md](README.md) for initial setup. In order to run this test you will need linux [strace](https://man7.org/linux/man-pages/man1/strace.1.html) and [time](https://man7.org/linux/man-pages/man1/time.1.html) tools. These should be pre-installed if you run in the docker created in README.md.

# initial investigation - using wc

First of all, let's see what performance we get from using the [wc](https://en.wikipedia.org/wiki/Wc_(Unix)) tool that comes with most if not all unix-y systems. We will pipe 500k 64k chunks from /dev/zero into 'wc -c' command to count the number of bytes.

```bash
time dd if=/dev/zero bs=65536 count=500000 | wc -c
```

Run it a few times to rule out any contention and we can see best performance on my setup of something like this
```bash
32768000000 bytes (33 GB, 31 GiB) copied, 8.20788 s, 4.0 GB/s

real    0m8.212s
```

So it takes 8.2 seconds in total and runs at a rate of 4 GB per second

# establishing a baseline - wc.c

We should be able to improve slightly on system wc if we write an optimised c version as the wc application does more than just count bytes and also likely does not have any processor specific optimisations that may help.

Here is our little program. It shouldn't need any explantion.

**wc.c**
```CPP
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>

int main(int argc, char *argv[]) {
  unsigned int blocksize = 65536;
  if (argc == 2) {
    blocksize = atoi(argv[1]);
  }
  char buf[blocksize];
  unsigned long size = 0;
  unsigned int reads = 0;
  int n = read(STDIN_FILENO, buf, blocksize);
  while (n > 0) {
    reads++;
    size += n;
    n = read(STDIN_FILENO, buf, blocksize);
  }
  if (n < 0) {
    fprintf(stderr, "read: %s (%i)\n", strerror(errno), errno);
    exit(1);
  }
  fprintf(stdout, "size %lu reads %u blocksize %u\n", size, reads, blocksize);
}
```

Let's compile it with all optimizations...

```bash
gcc -O3 -o wc wc.c
```

... and let's see what we get ...

```bash
time dd if=/dev/zero bs=65536 count=500000 | ./wc

500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 7.24869 s, 4.5 GB/s
size: 32768000000

real    0m7.253s
user    0m0.424s
sys     0m14.077s
```

Ok, so that's 7.2 seconds and 4.5 GB/s - a nice 11% improvement over the builtin wc tool.

While we are at it, let's see what syscalls our program makes

```
dd if=/dev/zero bs=65536 count=500000 | strace -c ./wc

% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
100.00    5.447454          11    500002           read
  0.00    0.000013           4         3           brk
  0.00    0.000009           3         3           fstat
```

So 500k read syscalls sounds about right and there are no other syscalls to speak of. We can compare this to the other programs later. This program is just running read() in a tight loop and doing little else, which is exactly what we want for our test.

# just sync performance

We will run with blocking/synchronous syscalls in wc.js and see how close we get to raw C performance.

**wc.js**
```js
const { print, error, exit, memoryUsage, sys, net } = just
const { read } = net
const { strerror, errno, STDIN_FILENO } = sys
const blocksize = parseInt(just.args[2] || 65536)
const buf = new ArrayBuffer(blocksize)
let size = 0
let reads = 0
let n = read(STDIN_FILENO, buf)
while (n > 0) {
  reads++
  size += n
  n = read(STDIN_FILENO, buf)
}
if (n < 0) {
  error(`read: ${strerror(errno())} (${errno()})`)
  exit(1)
}
print(`size ${size} reads ${reads} blocksize ${blocksize}`)
```

It shouldn't need much explanation. We import the internal modules we need from just runtime, create a 64k ArrayBuffer and then do blocking reads on stdin in a loop until we get 0 or an error code back.

Let's see what the results are like...

```bash
time dd if=/dev/zero bs=65536 count=500000 | just wc.js

500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 7.19774 s, 4.6 GB/s
size 32768000000 rss 18542592

real    0m7.205s
user    0m0.649s
sys     0m13.740s
```

So, looks like performance is exactly the same as the C version, if not a little faster. How can this be? Let's look at the syscalls to make sure we are making the same number of read() calls as the C version.

```
dd if=/dev/zero bs=65536 count=500000 | strace -c just wc.js

% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
 99.96    5.341601          11    500014           read
  0.02    0.000878           7       133         6 futex
  0.01    0.000495           5       110           mprotect
  0.00    0.000196          33         6           munmap
  0.00    0.000164           5        36           madvise
```

This looks good. The same 500k syscalls. We can also see some mprotect and futex calls. These are due to locking issues with ArrayBuffers in v8 - something I have looked into before but need to investigate further.

Let's just take a quick look at garbage collection stats and see what is happening. We are only allocating a single buffer outside the loop and on the C++ side we are only creating short lived v8 objects which should get marked as "young generation" and collected by the scavenger which is very quick.

```
dd if=/dev/zero bs=65536 count=500000 | just --trace-gc wc.js

[8451:0x298000000000]      688 ms: Scavenge 1.3 (1.5) -> 0.9 (2.0) MB, 0.3 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     1201 ms: Scavenge 1.3 (2.0) -> 0.9 (1.8) MB, 0.3 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     1819 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     2441 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     3059 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     3678 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     4304 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     4934 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     5555 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     6175 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
[8451:0x298000000000]     6799 ms: Scavenge 1.4 (1.8) -> 0.9 (1.8) MB, 0.1 / 0.0 ms  (average mu = 1.000, current mu = 1.000) allocation failure 
500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 7.38609 s, 4.4 GB/s
size 32768000000 rss 18587648
[8451:0x298000000000]     7381 ms: Mark-sweep (reduce) 1.3 (1.8) -> 0.1 (1.8) MB, 0.4 / 0.0 ms  (average mu = 1.000, current mu = 1.000) low memory notification GC in old space requested
[8451:0x298000000000]     7382 ms: Mark-sweep (reduce) 0.1 (1.8) -> 0.1 (1.0) MB, 0.4 / 0.0 ms  (average mu = 0.068, current mu = 0.068) low memory notification GC in old space requested
```

We can see the scavenger working away roughly every 600ms but having negligible impact on performance. The full Mark-sweep collection at the end is because just(js) runtime forces garbage collection and clean up of memory before exiting.

If you want to dive deeper into V8 garbage collection there are two very good articles [here](https://v8.dev/blog/trash-talk) and [here](https://v8.dev/blog/high-performance-cpp-gc) on the V8 team blog.

So, I think we are ok in asserting that **there is practically zero overhead to a simple syscall from JS compared to plain C**.

# just async performance

Let's do the same thing but using the event loop and only counting the bytes as the event loop tells us data is ready. The code here is slightly more complex as we need to mark the stdin file descriptor as non-blocking and add it to the default event loop of the just runtime.

**wc-async.js**
```js
const { net, sys, print, error, memoryUsage } = just
const { read, O_NONBLOCK } = net
const { strerror, errno, STDIN_FILENO } = sys
const { EPOLLIN } = just.loop
const { loop } = just.factory
const blocksize = parseInt(just.args[2] || 65536)
const buf = new ArrayBuffer(blocksize)
const flags = sys.fcntl(STDIN_FILENO, sys.F_GETFL, 0) | O_NONBLOCK
sys.fcntl(STDIN_FILENO, sys.F_SETFL, flags)
let size = 0
let reads = 0
function onData (fd) {
  const n = read(fd, buf)
  if (n < 0) {
    error(`read: ${strerror(errno())} (${errno()})`)
    loop.remove(fd)
    just.exit(1)
  }
  if (n === 0) {
    print(`size ${size} reads ${reads} blocksize ${blocksize} rss ${memoryUsage().rss}`)
    loop.remove(fd)
    return
  }
  reads++
  size += n
}
loop.add(STDIN_FILENO, onData, EPOLLIN)
```

We import the default event loop from the just runtime, use [fcntl](https://man7.org/linux/man-pages/man2/fcntl.2.html) to set the fd as non blocking, and then we tell the event loop that we are only listening for data coming in ([EPOLLIN](https://man7.org/linux/man-pages/man7/epoll.7.html)).

By default we are using level triggered events which means the event will carry on firing if we do not read all the available data on each iteration. If we had added EPOLLET to our mask as follows:

```js
const { EPOLLIN, EPOLLET } = just.loop
...
loop.add(STDIN_FILENO, onData, EPOLLIN | EPOLLET)
```

... then we would only receive an event when data was detected and would be expected to keep on reading until the read syscall returns EAGAIN to indicate the kernel buffer for that file descriptor is empty. If you want to delve deeper into this, I would suggest [this great article](https://copyconstruct.medium.com/the-method-to-epolls-madness-d9d2d6378642) from Cindy Sridharan.

So, let's see what the async results look like.

```
time dd if=/dev/zero bs=65536 count=500000 | just wc-async.js

500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 7.16841 s, 4.6 GB/s
size 32768000000 rss 19324928

real    0m7.175s
user    0m0.796s
sys     0m13.533s
```

Nice. So it looks like doing async adds little or no overhead to this program. Let's see what syscalls were made.

```
time dd if=/dev/zero bs=65536 count=500000 | strace -c just wc-async.js

% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
 76.89    5.228990          10    500013           read
 23.10    1.570899           3    500001           epoll_wait
  0.01    0.000503           6        83         1 futex
  0.00    0.000209           2        93           mprotect
```

Interesting. So even though we are making twice as many syscalls we get the same performance. What is going on here? I'll have to delve a little deeper into why this is the case but I am guessing it is something to do with the blocking calls in the first example having some additional overhead over the non-blocking reads in the async version.

# just(js) static build

Before we finish with just(js), let's have a look at the memory Usage. We can run a quick eval to see what default memory usage is on startup

```js
just eval 'just.print(just.memoryUsage().rss)'
13529088
```

So, about 13.5 MB. In the synchronous example we saw usage after the run was 18.5 MB and 19.3 MB for the async version. So the overhead of loading the various modules and running the code is around 5-6MB. If we are interested in reducing memory usage further we can compile the application into a static binary and see what happens.

First, we make a few changes to take into account our static app will not use any of the standard just(js) runtime created [here](https://github.com/just-js/just/blob/0.0.21/just.js#L245). Instead, we will compile a bare application that only uses the small number of functions (currently print, error, load, exit, pid, chdir, sleep, builtin, memoryUsage and version) in the just(js) [core](https://github.com/just-js/just/blob/0.0.21/just.cc#L462) and the builder will figure out what other modules it needs and compile those in. 

**wcb.js**
```js
// we need to use just.library() to load modules for now as that is how builder pickes them up
just.library = (name, lib = name) => just.load(name)
const { sys } = just.library('sys')
const { net } = just.library('net')
const { read } = net
const { strerror, errno, STDIN_FILENO } = sys
const blocksize = parseInt(just.args[1] || 65536)
const buf = new ArrayBuffer(blocksize)
let size = 0
let reads = 0
let n = 0
while ((n = read(STDIN_FILENO, buf))) {
  reads++
  size += n
}
if (n < 0) {
  just.error(`read: ${strerror(errno())} (${errno()})`)
  just.exit(1)
}
just.print(`size ${size} reads ${reads} blocksize ${blocksize}`)
```

Let's run a build with the --dump flag to see what kind of configuration this generates. We will also pass --clean and --static flags to tell it to clean up existing auto generated object files and to build a statically linked binary so we will have no runtime dependencies on system libraries. 

```bash
just build wcb.js --clean --static --dump

{
  "version": "0.0.21",
  "libs": [
    "lib/fs.js",
    "lib/loop.js",
    "lib/path.js",
    "lib/process.js",
    "lib/build.js",
    "lib/repl.js",
    "lib/configure.js",
    "lib/acorn.js"
  ],
  "modules": [
    {
      "name": "sys",
      "obj": [
        "modules/sys/sys.o"
      ],
      "lib": [
        "rt"
      ]
    },
    {
      "name": "fs",
      "obj": [
        "modules/fs/fs.o"
      ]
    },
    {
      "name": "net",
      "obj": [
        "modules/net/net.o"
      ]
    },
    {
      "name": "vm",
      "obj": [
        "modules/vm/vm.o"
      ]
    },
    {
      "name": "epoll",
      "obj": [
        "modules/epoll/epoll.o"
      ]
    }
  ],
  "capabilities": [],
  "target": "wcb",
  "main": "just.js",
  "v8flags": "--stack-trace-limit=10 --use-strict --disallow-code-generation-from-strings",
  "embeds": [
    "just.js",
    "config.js",
    "wcb.js"
  ],
  "static": true,
  "debug": false,
  "v8flagsFromCommandLine": true,
  "external": {},
  "index": "wcb.js",
  "LIBS": "lib/fs.js lib/loop.js lib/path.js lib/process.js lib/build.js lib/repl.js lib/configure.js lib/acorn.js",
  "EMBEDS": "just.js config.js wcb.js",
  "MODULES": "modules/sys/sys.o modules/fs/fs.o modules/net/net.o modules/vm/vm.o modules/epoll/epoll.o",
  "LIB": "-lrt",
  "justDir": "/home/andrew/.just",
  "build": "main-static",
  "moduleBuild": "module-static"
}
```

Ok, so that looks like it has a bunch of extra junk in there that we don't need for our mini-app. So, let's create a config for the app to tell the builder we want to use 'wcb.js' as our main script and not 'just.js'.

wcb.config.js
```js
module.exports = { main: 'wcb.js' }
```

And let's dump the config again and see what comes out this time.

```bash
just build wcb.js --clean --static --dump

{
  "main": "wcb.js",
  "external": {},
  "modules": [
    {
      "name": "sys",
      "obj": [
        "modules/sys/sys.o"
      ],
      "lib": [
        "rt"
      ]
    },
    {
      "name": "net",
      "obj": [
        "modules/net/net.o"
      ]
    }
  ],
  "target": "wcb",
  "version": "0.0.21",
  "v8flags": "--stack-trace-limit=10 --use-strict --disallow-code-generation-from-strings",
  "debug": false,
  "capabilities": [],
  "static": true,
  "libs": [],
  "embeds": [
    "wcb.js"
  ],
  "LIBS": "",
  "EMBEDS": "wcb.js",
  "MODULES": "modules/sys/sys.o modules/net/net.o",
  "LIB": "-lrt",
  "justDir": "/home/andrew/.just",
  "build": "main-static",
  "moduleBuild": "module-static"
}
```

That looks better. Now we are only importing the sys and net C++ modules and none of the JS files and c++ libraries not required for this program. Let's go ahead and build it. In order to build it an app, we will need to set JUST_HOME environment variable to tell the builder where to download and build the various things it needs. You can set this to the directory you compiled the runtime in or if you are using docker it will already be set for you.

```bash
just build wcb.js --cleanall --clean --static --silent

clean wcb complete in 0.01 sec
clean modules/sys complete in 0.02 sec
build modules/sys complete in 1.35 sec
clean modules/net complete in 1.36 sec
build modules/net complete in 2.37 sec
build wcb 0.0.21 (wcb.js) complete in 5.99 sec
```

If you have issues with previous versions of object files that were generated you can pass the --cleanall flag also which will clean the C++ modules and rebuild them. The build system is very much a work in progress so please report any issues [here](https://github.com/just-js/just/issues).

We should now have a nice small binary called 'wcb' in the current directory. On my system this comes out around 13MB which is quite a bit smaller than the dynamic build. Bear in mind that a static build will not be able to import any libraries using dlopen at run-time so this option is very much for those cases where the app has all the dependencies it needs bundled up within it.

Let's run the test on our new binary and see what the memory usage is like.

```bash
time dd if=/dev/zero bs=65536 count=500000 | ./wcb

500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 7.2249 s, 4.5 GB/s
size 32768000000 rss 12763136

real    0m7.232s
user    0m0.581s
sys     0m13.869s
```

Nice! we just saved about 6MB of memory over the version running under just(js) runtime.

# comparing to node

Ok, we will now do a quick comparison against a typical node.js program which meets our requirement.

**wc-node.js**
```js
let size = 0
const { stdin } = process
let reads = 0
const blocksize = parseInt(process.argv[2] || 65536, 10)
stdin.on('readable', () => {
  let chunk
  while ((chunk = stdin.read())) {
    reads++
    size += chunk.length
  }
})
stdin.on('end', () => {
  console.log(`size ${size} reads ${reads} blocksize ${blocksize}`)
})
stdin.on('error', err => {
  console.error(err.stack)
})
```

Let's run it and see how it does. I am running v15.6.0 of node.js on Ubuntu 18.04.

```
time dd if=/dev/zero bs=65536 count=500000 | node wc-node.js

500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 8.93132 s, 3.7 GB/s
size 32768000000 rss 56827904

real    0m8.941s
user    0m2.432s
sys     0m15.505s
```

So, we are seeing a run time of 8.9 seconds and a processing rate of 3.7 GB/s. This is about a 23% decrease in throughput. If we look at memory usage we can see the node.js process is consuming 56MB compared to 19MB or 13MB with just(js), a factor of 3-4 higher.

Let's see if we can make the node.js program do a little better than this. We'll write something that calls the C++ bindings directly. There used to be a way of doing this in a blocking fashion in node.js many moons ago but i was unable to figure it out when digging through the node.js source code for this demo.

**wc-node-fast.js**
```js
const { Pipe } = process.binding('pipe_wrap')
const blocksize = parseInt(process.argv[2] || 65536, 10)
const stdin = new Pipe(0)
stdin.open(0)
let size = 0
let reads = 0
stdin.onread = buf => {
  if (!buf) {
    console.log(`size ${size} reads ${reads} blocksize ${blocksize} rss ${process.memoryUsage().rss}`)
    return
  }
  reads++
  size += buf.byteLength
}
stdin.readStart()
```

Let's run it and see if we get a better result.

```
time dd if=/dev/zero bs=65536 count=500000 | node wc-node-fast.js

500000+0 records in
500000+0 records out
32768000000 bytes (33 GB, 31 GiB) copied, 8.85562 s, 3.7 GB/s
size 32768000000 rss 66383872

real    0m8.867s
user    0m1.587s
sys     0m16.226s
```

Hmmm... this is no faster and now memory usage is 10MB more. Let's take a look at syscalls in the node.js version.

```
dd if=/dev/zero bs=65536 count=500000 | strace -c node wc-node-fast.js

% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
 98.06    5.654736          11    500019         5 read
  1.01    0.058474           3     17994      6502 futex
  0.78    0.044935           3     15671           epoll_wait
  0.09    0.005060           3      1965           getpid
```

and with the first node.js version...

```
dd if=/dev/zero bs=65536 count=500000 | strace -c node wc-node.js

% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
 96.62    5.446947          11    500032        15 read
  1.39    0.078514           3     31270     15633 epoll_ctl
  1.21    0.068166           3     21504      6990 futex
  0.68    0.038313           2     15643           epoll_wait
  0.08    0.004764           2      1966           getpid
```

Ok, we can see a significant number of extra syscalls here. The second program is calling futex and epoll_wait a lot more than the just(js) versions. This needs further investigation and is likely to do with extra garbage collection and a different polling mechanism on the event loop. We can see both node.js programs do the same number of reads so we are reading in 64k chunks across the board.

For now, I will have to leave the experiment with node.js as I cannot figure out a way to make this do better without writing a C++ module. Let's do some runs for different block sizes and see what the overall results look like.

# different block sizes

The script 'bench.js' will perform ten runs for each program across all power of 2 block sizes from 256 bytes to 65536 bytes. It saves all results in a file names 'all.json'. It will take the best score across the ten rounds for each program and save them in a file named 'results.json'. If you then run 'analyse.js' it will produce a html page with the results plotted using HighCharts.

```bash
# run the benchmark and produce all.json and results.json
just bench.js
# generate a report on the results and display in the browser - not xdg-open will not work on docker
just analyse.js
```

## throughput/MBps

![throughput](throughput-mbps.png)

This shows the best performance over 10 runs for each program at the different chunk sizes. We can see pretty clearly there is no significant difference between the JS and c versions of the programs. In fact, we see slightly better performance from the JS programs with smaller chunk sizes.

We can see here node.js throughput is approx. 30% lower than the c or just(js) programs.

## time taken/ms

![duration](time-taken-ms.png)

And the same picture when we look at time taken.

Unfortunately, i could not find any way of forcing node.js to read from the pipe in explicitly sized chunks for the comparison above. It's so frustrating to have to wade through tons and tons of web pages and stack overflow questions and the source code itself only to find there doesn't seem to be any way to do this. If anyone knows how, please ping me.

# assertions

So, that brings the investigations to an end for now. Let's see if we make make some assertions.

- There is practically zero overhead for JIT optimized JS when calling into C/C++ for the linux read() syscall
- just(js) performance is equal to optimized C for reading data from stdin
- just(js) and C performance is approximately 30% faster than node.js for this task. Further investigation is needed to ascertain why.
- if your program is syscall heavy, there should be negligible overhead in using JS over C/C++

# further work

- investigate overhead for calls with larger and different types of arguments
- investigate where the overhead is coming from in node.js and if it is possible to eliminate some or all of it
- compare calls from JS into C++ to an unoptmized C call into another c function to determine overhead without the cost of a syscall.

Please feel free to point out any mistakes/omissions and point out any improvements that could be made.
