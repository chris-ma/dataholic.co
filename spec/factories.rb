FactoryGirl.define do 

  factory :campaign do
    sequence(:name) { |n| "Global campaign"}
    description "This is the largest campaign in the universe"

  end
end