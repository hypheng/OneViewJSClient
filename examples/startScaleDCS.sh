for appliance in $@; do
  echo "start scale dcs on $appliance"
  ssh $appliance dcs stop
  ssh $appliance dcs start /dcs/schematic/storage_scale/40/ cold
  echo "done"
done
