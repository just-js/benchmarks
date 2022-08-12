local counter = 1
local threads = {}

function setup(thread)
	thread:set("id", counter)
	table.insert(threads, thread)
	counter = counter + 1
end

response = function(status, headers, body) 
	if statuses[status] == nil then
		statuses[status] = 1
	else
		statuses[status] = statuses[status] + 1
	end
end

done = function(summary, latency, requests)
	for index, thread in ipairs(threads) do
		local statuses = thread:get("statuses")
		local id = thread:get("id")
		for key, value in pairs(statuses) do 
			io.write(string.format("Thread: %d, %s: %d\n", id, key, value))
		end
	end
	for _, p in pairs({ 50, 75, 90, 95, 99, 99.999 }) do
		 n = latency:percentile(p)
		 io.write(string.format("%g%%,%d\n", p, n))
	end	
end

init = function(args)
	statuses = {}
  local r = {}
  local depth = tonumber(args[1]) or 1
  for i=1,depth do
    r[i] = wrk.format()
  end
  req = table.concat(r)
end

request = function()
  return req
end