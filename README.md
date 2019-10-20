# CR_SearchEngine
Composite retrieval search engine based on Searsia, which is a part of my BSc dissertation project "Searching information by using composite retrieval search engine".

run SearsiaServer by following command

"java -jar searsiaserver.jar -m none -n gole -p /Users/zhengfang/OneDrive/Git\ Repository/Searsia/searsia/local_log -u http://localhost:16842/searsia" 

usage: SearsiaServer
- -c,--cache <arg>      Set cache size (integer: number of result pages).
- -e,--exit             Exit immediately after startup.
- -h,--help             Show help.
- -i,--interval <arg>   Set poll interval (integer: in seconds).
- -l,--log <arg>        Set log level (0=off, 1=error, 2=warn=default,
                        3=info, 4=debug).
- -m,--mother <arg>     Set api template of the mother. ('none' for
                    standalone)
- -n,--name <arg>       Set my id (name).
- -o,--open             Open the system for on-line updates (be careful!)
- -p,--path <arg>       Set index path.
- -q,--quiet            No output on console.
- -u,--url <arg>        Set url of my web service endpoint.

 
The client will connect to the Searsia server of "http://localhost:16842/searsia". To connect to another server, 
edit the variable `API_TEMPLATE` in the file `js/searsia.js`. Once you have started the server, you can start 
browning by opening `index.html` in a web browser.

future work:
1. convert scripts to python
2. add chinese language support
3. improve performance

# hope you all have fun about this, best wishes


=======
Searsia web client
==================
http://searsia.org

Usage: Open `index.html` in a web browser... done.

The client will automatically connect to the Searsia server of
[University of Twente Search][1]. To connect to another server, 
edit the variable `API_TEMPLATE` in the file `js/searsia.js`.

[1]: https://search.utwente.nl/searsia/search "UT Search Server"
