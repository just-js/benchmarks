FROM ubuntu:latest
RUN apt update
RUN apt install -y curl unzip xz-utils libsqlite3-dev gzip make tar g++ tclsh libffi-dev libz-dev
WORKDIR /bench
RUN /bin/bash -o pipefail -c "$(curl -fsSL https://bun.sh/install)"
RUN /bin/bash -o pipefail -c "$(curl -fsSL https://deno.land/x/install/install.sh)"
WORKDIR /root/.just
ARG JUST_VERSION=0.1.10
RUN curl -L -o just.tar.gz https://github.com/just-js/just/archive/$JUST_VERSION.tar.gz
RUN tar -zxvf just.tar.gz
WORKDIR /root/.just/just-$JUST_VERSION
RUN make clean runtime
RUN make libs
RUN mkdir -p /usr/local/lib/just
RUN make -C modules/sqlite deps
WORKDIR /root/.just/just-$JUST_VERSION/modules/sqlite/deps/sqlite/build
RUN ../configure --disable-math --disable-readline --disable-tcl --with-pic --enable-session --disable-load-extension
RUN make -j 4
WORKDIR /root/.just/just-$JUST_VERSION
ENV JUST_HOME=/root/.just/just-$JUST_VERSION
ENV JUST_TARGET=/root/.just/just-$JUST_VERSION
RUN make -C modules/sqlite library vfs install 
RUN make -C modules/ffi library install 
RUN mkdir /root/.just/bin && cp just /root/.just/bin/
WORKDIR /bench/node
ARG NODE_VERSION=16.16.0
RUN curl -o node.tar.xz https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz
RUN tar -xvf node.tar.xz
RUN mkdir -p /root/.node/bin && cp node-v$NODE_VERSION-linux-x64/bin/node /root/.node/bin/
ENV NODE_ENV=production
WORKDIR /bench/wrk
RUN curl -L -o wrk.tar.gz https://github.com/wg/wrk/archive/refs/tags/4.2.0.tar.gz
RUN tar -zxvf wrk.tar.gz
RUN make -j8 -C wrk-4.2.0/
RUN mkdir -p /root/.wrk/bin && cp wrk-4.2.0/wrk /root/.wrk/bin/
WORKDIR /bench
RUN rm -fr ./*
ENV PATH="${PATH}:/root/.deno/bin"
ENV PATH="${PATH}:/root/.bun/bin"
ENV PATH="${PATH}:/root/.node/bin"
ENV PATH="${PATH}:/root/.just/bin"
ENV PATH="${PATH}:/root/.wrk/bin"
RUN apt clean all
RUN rm -fr /var/lib/apt/lists
CMD ["/bin/bash"]
