FROM benchmark:latest
WORKDIR /bench
ADD . .
RUN tar -zxvf node_modules.tar.gz
RUN rm node_modules.tar.gz
RUN gcc -O3 -c -Wall -Wextra -Ideps/sqlite/build -o bench.o bench.c
ARG JUST_VERSION=0.1.10
RUN gcc -static -mtune=native -march=native -flto -pthread -m64 -s -o bench-c bench.o /root/.just/just-$JUST_VERSION/modules/sqlite/deps/sqlite/build/.libs/libsqlite3.a
RUN rm bench.o
RUN just build --clean --cleanall --static bench-just.js
RUN deno bundle bench-deno.js > bench-deno-bundle.js
RUN apt clean all
RUN rm -fr /var/lib/apt/lists
CMD ["/bin/bash"]
