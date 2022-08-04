FROM gitpod/workspace-full:latest
RUN sudo install-packages curl unzip xz-utils libsqlite3-dev gzip make tar g++ tclsh libffi-dev libz-dev
WORKDIR /home/gitpod/build
RUN /bin/bash -o pipefail -c "$(curl -fsSL https://bun.sh/install)"
RUN /bin/bash -o pipefail -c "$(curl -fsSL https://deno.land/x/install/install.sh)"
WORKDIR /home/gitpod/.just
RUN sudo chown gitpod:gitpod /home/gitpod/.just
ARG JUST_VERSION=0.1.10
RUN curl -L -o just.tar.gz https://github.com/just-js/just/archive/$JUST_VERSION.tar.gz
RUN tar -zxvf just.tar.gz
WORKDIR /home/gitpod/.just/just-$JUST_VERSION
RUN sudo chown -R gitpod:gitpod /home/gitpod/.just
RUN make libs
RUN make modules
RUN sudo ldconfig
RUN make -C modules/sys library
RUN make runtime
RUN sudo make install install-debug
RUN sudo mkdir -p /usr/local/lib/just
RUN make -C modules/sqlite deps
WORKDIR /home/gitpod/.just/just-$JUST_VERSION/modules/sqlite/deps/sqlite/build
RUN sudo chown -R gitpod:gitpod /home/gitpod/.just
RUN ../configure --disable-math --disable-readline --disable-tcl --with-pic --enable-session --disable-load-extension
RUN make -j 4
WORKDIR /home/gitpod/.just/just-$JUST_VERSION
ENV JUST_HOME=/home/gitpod/.just/just-$JUST_VERSION
ENV JUST_TARGET=/home/gitpod/.just/just-$JUST_VERSION
RUN make -C modules/sqlite library vfs
RUN sudo make -C modules/sqlite install
RUN make -C modules/ffi library
RUN sudo make -C modules/ffi install
WORKDIR /home/gitpod/build
RUN sudo chown gitpod:gitpod /home/gitpod/build
ARG NODE_VERSION=16.16.0
RUN curl -o node.tar.xz https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz
RUN tar -xvf node.tar.xz
RUN mkdir -p /home/gitpod/.node/bin && cp node-v$NODE_VERSION-linux-x64/bin/node /home/gitpod/.node/bin/
ENV NODE_ENV=production
WORKDIR /home/gitpod
RUN rm -fr build
ENV PATH="${PATH}:/home/gitpod/.deno/bin"
ENV PATH="${PATH}:/home/gitpod/.bun/bin"
ENV PATH="${PATH}:/home/gitpod/.node/bin"
RUN sudo apt clean all
RUN sudo rm -fr /var/lib/apt/lists
ENV JUST_VERSION=$JUST_VERSION
WORKDIR /workspace/benchmarks
CMD ["/bin/bash"]
